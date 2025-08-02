import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { format } from "date-fns";
import {
  BudgetCategory,
  FixedExpense,
  Expense,
  MonthlyBudget,
  DashboardData,
} from "@/types";
import { firestoreService, FamilyMember } from "@/services/firestoreService";

interface ExpenseStoreState {
  currentBudget: MonthlyBudget | null;
  budgetHistory: MonthlyBudget[];
  selectedMonth: string;

  // Firestore sync state
  isInitializing: boolean;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncTime: number | null;
  isListenerActive: boolean; // Add this flag

  // Family state
  familyId: string | null;
  familyMembers: FamilyMember[];
  currentMember: FamilyMember | null;

  // Actions
  setSelectedMonth: (month: string) => void;

  // Firestore actions
  initializeFirestore: () => Promise<void>;
  createOrJoinFamily: (familyId?: string) => Promise<string>;
  setMemberName: (name: string) => void;
  syncToFirestore: () => Promise<void>;
  loadFromFirestore: () => Promise<void>;

  createMonthlyBudget: (salary: number, month?: string) => void;
  updateCategoryAllocation: (categoryId: string, amount: number) => void;
  addFixedExpense: (
    categoryId: string,
    name: string,
    amount: number,
    dueDate?: string
  ) => void;
  markFixedExpenseComplete: (expenseId: string) => void;
  addManualExpense: (
    categoryId: string,
    amount: number,
    description: string,
    date?: string
  ) => Promise<void>;
  editExpense: (
    expenseId: string,
    categoryId: string,
    amount: number,
    description: string,
    date: string
  ) => void;
  deleteExpense: (expenseId: string) => void;
  topupCategory: (
    fromCategoryId: string,
    toCategoryId: string,
    amount: number
  ) => void;
  getDashboardData: () => DashboardData;
  getCurrentMonth: () => string;
  debugExpenses: () => ExpenseStoreState;
}

const defaultCategories = [
  { name: "Fixed Savings", type: "fixed_savings" as const },
  { name: "Variable Savings", type: "variable_savings" as const },
  { name: "Fixed Expenses", type: "fixed_expenses" as const },
  { name: "Grocery", type: "grocery" as const },
  { name: "Unplanned Expenses", type: "unplanned" as const },
];

const predefinedFixedExpenses = [
  { name: "Milk Bill", amount: 1500 },
  { name: "House Maintenance", amount: 1000 },
  { name: "Fuel", amount: 2000 },
  { name: "Electricity", amount: 1000 },
  { name: "Internet", amount: 1000 },
  { name: "Gas Bill", amount: 1000 },
  { name: "AC EMI", amount: 5000 },
  { name: "Mom house rent", amount: 6500 },
  { name: "Mom medicine", amount: 1000 },
];

const getTotalPredefinedFixedExpenses = () =>
  predefinedFixedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

// Helper function to recalculate category spending from expenses
const recalculateCategorySpending = (budget: MonthlyBudget): MonthlyBudget => {
  const categorySpending = new Map<string, number>();

  // Calculate spending from all expenses
  budget.expenses.forEach((expense) => {
    const currentSpent = categorySpending.get(expense.categoryId) || 0;
    categorySpending.set(expense.categoryId, currentSpent + expense.amount);
  });

  // Update categories with accurate spending
  const updatedCategories = budget.categories.map((cat) => ({
    ...cat,
    spentAmount: categorySpending.get(cat.id) || 0,
  }));

  return {
    ...budget,
    categories: updatedCategories,
  };
};

// Intelligent data merging function to prevent data loss
const mergeRemoteWithLocal = (
  localBudgets: MonthlyBudget[],
  remoteBudgets: MonthlyBudget[]
): MonthlyBudget[] => {
  console.log(
    `🔄 Merging data - Local: ${localBudgets.length} budgets, Remote: ${remoteBudgets.length} budgets`
  );

  const merged: MonthlyBudget[] = [];

  // Create a map of remote budgets for quick lookup
  const remoteBudgetMap = new Map(remoteBudgets.map((b) => [b.id, b]));

  // Process local budgets first to preserve local changes
  for (const localBudget of localBudgets) {
    const remoteBudget = remoteBudgetMap.get(localBudget.id);

    if (remoteBudget) {
      // Merge expenses from both local and remote, avoiding duplicates
      const allExpenses = [...localBudget.expenses];
      const localExpenseIds = new Set(localBudget.expenses.map((e) => e.id));

      let addedRemoteExpenses = 0;
      // Add remote expenses that don't exist locally
      for (const remoteExpense of remoteBudget.expenses) {
        if (!localExpenseIds.has(remoteExpense.id)) {
          allExpenses.push(remoteExpense);
          addedRemoteExpenses++;
        }
      }

      console.log(
        `📊 Budget ${localBudget.month}: Local=${localBudget.expenses.length}, Remote=${remoteBudget.expenses.length}, Added=${addedRemoteExpenses}, Total=${allExpenses.length}`
      );

      // Use the most recent version based on timestamps
      const isRemoteNewer =
        new Date(remoteBudget.createdAt) > new Date(localBudget.createdAt);
      const baseBudget = isRemoteNewer ? remoteBudget : localBudget;

      // Use the recalculation helper for consistency
      const budgetWithMergedExpenses = {
        ...baseBudget,
        expenses: allExpenses,
      };
      merged.push(recalculateCategorySpending(budgetWithMergedExpenses));

      remoteBudgetMap.delete(localBudget.id);
    } else {
      // Local budget doesn't exist remotely, keep it
      console.log(
        `📱 Keeping local-only budget: ${localBudget.month} (${localBudget.expenses.length} expenses)`
      );
      merged.push(localBudget);
    }
  }

  // Add remaining remote budgets that don't exist locally
  for (const remoteBudget of remoteBudgetMap.values()) {
    console.log(
      `☁️ Adding remote-only budget: ${remoteBudget.month} (${remoteBudget.expenses.length} expenses)`
    );
    merged.push(remoteBudget);
  }

  console.log(`✅ Merge complete: ${merged.length} total budgets`);
  return merged;
};

export const useExpenseStore = create<ExpenseStoreState>()(
  persist(
    (set, get) => ({
      currentBudget: null,
      budgetHistory: [],
      selectedMonth: format(new Date(), "yyyy-MM"),

      // Firestore state
      isInitializing: false,
      isSyncing: false,
      syncError: null,
      lastSyncTime: null,
      isListenerActive: false, // Add flag to prevent multiple listeners

      // Family state
      familyId: null,
      familyMembers: [],
      currentMember: null,

      initializeFirestore: async () => {
        const state = get();
        if (state.isInitializing || state.isListenerActive) return; // Prevent duplicate calls

        set({ isInitializing: true, syncError: null });

        try {
          // First try to restore from persisted state
          let familyId = state.familyId;
          let currentMember = state.currentMember;

          console.log("🔄 Initializing Firestore...");
          console.log("Persisted family ID:", familyId);
          console.log("Persisted member:", currentMember?.name);

          // Initialize the service (this will try localStorage if no persisted state)
          await firestoreService.initialize();

          // Get family ID from service (localStorage or existing state)
          const serviceFamilyId = firestoreService.getFamilyId();
          const serviceMember = firestoreService.getCurrentMember();

          // Use service data if we don't have persisted state
          if (!familyId && serviceFamilyId) {
            familyId = serviceFamilyId;
            console.log("📱 Using family ID from localStorage:", familyId);
          }

          if (!currentMember && serviceMember) {
            currentMember = serviceMember;
            console.log("👤 Using member from service:", currentMember.name);
          }

          set({
            familyId,
            currentMember,
            isInitializing: false,
          });

          // Only set up listener if we have a family and don't already have one
          if (familyId && !state.isListenerActive) {
            console.log(
              "🔔 Setting up real-time listener for family:",
              familyId
            );
            set({ isListenerActive: true });

            // Set up real-time listener
            firestoreService.subscribeToFamilyUpdates((budgets, updatedBy) => {
              console.log(`📡 Real-time update from member: ${updatedBy}`);
              const currentState = get();

              // Prevent self-updates to avoid loops
              if (updatedBy === firestoreService.getMemberId()) return;

              // Intelligent data merging instead of replacing
              const mergedBudgets = mergeRemoteWithLocal(
                currentState.budgetHistory,
                budgets
              );
              const currentBudget = mergedBudgets.find(
                (b: MonthlyBudget) => b.month === currentState.selectedMonth
              );

              set({
                budgetHistory: mergedBudgets,
                currentBudget: currentBudget || currentState.currentBudget,
                lastSyncTime: Date.now(),
              });
            });

            // Load initial data only once
            await get().loadFromFirestore();
            console.log("✅ Family connection restored successfully");
          } else if (familyId) {
            console.log("🔗 Already connected to family:", familyId);
          } else {
            console.log("📱 No family to connect to - ready for setup");
          }
        } catch (error) {
          console.error("Failed to initialize Firestore:", error);
          set({
            syncError:
              error instanceof Error ? error.message : "Failed to initialize",
            isInitializing: false,
          });
        }
      },

      createOrJoinFamily: async (familyId?: string) => {
        set({ isSyncing: true, syncError: null });

        try {
          const newFamilyId = await firestoreService.createOrJoinFamily(
            familyId
          );
          const currentMember = firestoreService.getCurrentMember();

          set({
            familyId: newFamilyId,
            currentMember,
            isSyncing: false,
          });

          // Set up real-time listener only if not already active
          const state = get();
          if (!state.isListenerActive) {
            set({ isListenerActive: true });

            firestoreService.subscribeToFamilyUpdates((budgets, updatedBy) => {
              console.log(`📡 Real-time update from member: ${updatedBy}`);
              const currentState = get();

              // Prevent self-updates to avoid loops
              if (updatedBy === firestoreService.getMemberId()) return;

              const currentBudget = budgets.find(
                (b) => b.month === currentState.selectedMonth
              );

              set({
                budgetHistory: budgets,
                currentBudget: currentBudget || currentState.currentBudget,
                lastSyncTime: Date.now(),
              });
            });
          }

          // Sync local data to Firestore (without loading back)
          const localBudgets = get().budgetHistory;
          if (localBudgets.length > 0) {
            await get().syncToFirestore();
          } else {
            // Only load if we have no local data
            await get().loadFromFirestore();
          }

          return newFamilyId;
        } catch (error) {
          console.error("Failed to create/join family:", error);
          set({
            syncError:
              error instanceof Error
                ? error.message
                : "Failed to create/join family",
            isSyncing: false,
          });
          throw error;
        }
      },

      setMemberName: (name: string) => {
        firestoreService.setMemberName(name);
        set({
          currentMember: {
            ...get().currentMember!,
            name,
          },
        });
      },

      syncToFirestore: async () => {
        const state = get();
        if (!state.familyId || state.budgetHistory.length === 0) return;

        set({ isSyncing: true, syncError: null });

        try {
          // Sync all budgets to Firestore
          for (const budget of state.budgetHistory) {
            await firestoreService.saveBudget(budget);
          }

          set({
            isSyncing: false,
            lastSyncTime: Date.now(),
            syncError: null,
          });
        } catch (error) {
          console.error("Failed to sync to Firestore:", error);
          set({
            syncError: error instanceof Error ? error.message : "Sync failed",
            isSyncing: false,
          });
        }
      },

      loadFromFirestore: async () => {
        const state = get();
        if (!state.familyId) return;

        set({ isSyncing: true, syncError: null });

        try {
          const remoteBudgets = await firestoreService.getBudgets();

          // Merge remote data with local data to prevent loss
          const mergedBudgets = mergeRemoteWithLocal(
            state.budgetHistory,
            remoteBudgets
          );
          const currentBudget = mergedBudgets.find(
            (b: MonthlyBudget) => b.month === state.selectedMonth
          );

          set({
            budgetHistory: mergedBudgets,
            currentBudget: currentBudget || state.currentBudget,
            isSyncing: false,
            lastSyncTime: Date.now(),
            syncError: null,
          });
        } catch (error) {
          console.error("Failed to load from Firestore:", error);
          set({
            syncError: error instanceof Error ? error.message : "Load failed",
            isSyncing: false,
          });
        }
      },

      setSelectedMonth: (month: string) => {
        set({ selectedMonth: month });

        const state = get();
        const budget = state.budgetHistory.find((b) => b.month === month);

        if (budget) {
          set({ currentBudget: budget });
        } else {
          set({ currentBudget: null });
        }
      },

      createMonthlyBudget: async (salary: number, month?: string) => {
        const currentMonth = month || get().getCurrentMonth();
        const budgetId = `budget_${currentMonth}_${Date.now()}`;

        const categories: BudgetCategory[] = defaultCategories.map(
          (category) => ({
            id: `${category.name
              .toLowerCase()
              .replace(/\s+/g, "_")}_${Date.now()}_${Math.random()}`,
            name: category.name,
            type: category.type,
            allocatedAmount: 0,
            spentAmount: 0,
            month: currentMonth,
          })
        );

        const fixedExpenseCategory = categories.find(
          (cat) => cat.type === "fixed_expenses"
        );
        const fixedExpenses: FixedExpense[] = [];

        if (fixedExpenseCategory) {
          predefinedFixedExpenses.forEach((expense) => {
            fixedExpenses.push({
              id: `${expense.name
                .toLowerCase()
                .replace(/\s+/g, "_")}_${Date.now()}_${Math.random()}`,
              categoryId: fixedExpenseCategory.id,
              name: expense.name,
              amount: expense.amount,
              isCompleted: false,
              dueDate: format(new Date(), "yyyy-MM-dd"),
            });
          });

          fixedExpenseCategory.allocatedAmount =
            getTotalPredefinedFixedExpenses();
        }

        const newBudget: MonthlyBudget = {
          id: budgetId,
          month: currentMonth,
          totalSalary: salary,
          categories,
          fixedExpenses,
          expenses: [],
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          currentBudget: newBudget,
          budgetHistory: [...state.budgetHistory, newBudget],
        }));

        // Auto-sync to Firestore if connected
        if (get().familyId) {
          await get().syncToFirestore();
        }
      },

      updateCategoryAllocation: async (categoryId: string, amount: number) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const updatedCategories = state.currentBudget.categories.map((cat) =>
            cat.id === categoryId ? { ...cat, allocatedAmount: amount } : cat
          );

          const updatedBudget = {
            ...state.currentBudget,
            categories: updatedCategories,
          };

          const updatedHistory = state.budgetHistory.map((budget) =>
            budget.id === state.currentBudget?.id ? updatedBudget : budget
          );

          return {
            currentBudget: updatedBudget,
            budgetHistory: updatedHistory,
          };
        });

        // Auto-sync to Firestore if connected
        if (get().familyId) {
          await get().syncToFirestore();
        }
      },

      addFixedExpense: async (
        categoryId: string,
        name: string,
        amount: number,
        dueDate?: string
      ) => {
        const expenseId = `fixed_${Date.now()}_${Math.random()}`;
        const newFixedExpense: FixedExpense = {
          id: expenseId,
          categoryId,
          name,
          amount,
          isCompleted: false,
          dueDate: dueDate || format(new Date(), "yyyy-MM-dd"),
        };

        set((state) => {
          if (!state.currentBudget) return state;

          const updatedBudget = {
            ...state.currentBudget,
            fixedExpenses: [
              ...state.currentBudget.fixedExpenses,
              newFixedExpense,
            ],
          };

          const updatedHistory = state.budgetHistory.map((budget) =>
            budget.id === state.currentBudget?.id ? updatedBudget : budget
          );

          return {
            currentBudget: updatedBudget,
            budgetHistory: updatedHistory,
          };
        });

        // Auto-sync to Firestore if connected
        if (get().familyId) {
          await get().syncToFirestore();
        }
      },

      markFixedExpenseComplete: async (expenseId: string) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const fixedExpense = state.currentBudget.fixedExpenses.find(
            (fe) => fe.id === expenseId
          );
          if (!fixedExpense) return state;

          const manualExpenseId = `expense_${Date.now()}_${Math.random()}`;
          const newManualExpense: Expense = {
            id: manualExpenseId,
            categoryId: fixedExpense.categoryId,
            amount: fixedExpense.amount,
            description: fixedExpense.name,
            date: new Date().toISOString(),
            type: "fixed",
          };

          const updatedFixedExpenses = state.currentBudget.fixedExpenses.map(
            (fe) => (fe.id === expenseId ? { ...fe, isCompleted: true } : fe)
          );

          const budgetWithNewExpense = {
            ...state.currentBudget,
            fixedExpenses: updatedFixedExpenses,
            expenses: [...state.currentBudget.expenses, newManualExpense],
          };

          // Recalculate all category spending
          const updatedBudget =
            recalculateCategorySpending(budgetWithNewExpense);

          const updatedHistory = state.budgetHistory.map((budget) =>
            budget.id === state.currentBudget?.id ? updatedBudget : budget
          );

          return {
            currentBudget: updatedBudget,
            budgetHistory: updatedHistory,
          };
        });

        // Auto-sync to Firestore if connected
        if (get().familyId) {
          await get().syncToFirestore();
        }
      },

      addManualExpense: async (
        categoryId: string,
        amount: number,
        description: string,
        date?: string
      ) => {
        const expenseId = `expense_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        const newExpense: Expense = {
          id: expenseId,
          categoryId,
          amount,
          description,
          date: date || new Date().toISOString(),
          type: "manual",
        };

        console.log(
          `💰 Adding expense: ${description} (${amount}) - ID: ${expenseId}`
        );

        set((state) => {
          if (!state.currentBudget) {
            console.error("❌ Cannot add expense: No current budget");
            return state;
          }

          // Add the expense first
          const budgetWithNewExpense = {
            ...state.currentBudget,
            expenses: [...state.currentBudget.expenses, newExpense],
          };

          // Recalculate all category spending to ensure accuracy
          const updatedBudget =
            recalculateCategorySpending(budgetWithNewExpense);

          const updatedHistory = state.budgetHistory.map((budget) =>
            budget.id === state.currentBudget?.id ? updatedBudget : budget
          );

          console.log(
            `✅ Expense added locally. Total expenses in budget: ${updatedBudget.expenses.length}`
          );

          return {
            currentBudget: updatedBudget,
            budgetHistory: updatedHistory,
          };
        });

        // Auto-sync to Firestore if connected with delay to prevent race conditions
        if (get().familyId) {
          // Small delay to ensure local state is updated first
          setTimeout(async () => {
            try {
              console.log(
                `🔄 Syncing expense "${description}" to Firestore...`
              );
              await get().syncToFirestore();
              console.log(`✅ Expense "${description}" synced to Firestore`);

              // Verify the expense exists after sync
              const currentState = get();
              const expenseExists = currentState.currentBudget?.expenses.some(
                (e) => e.id === expenseId
              );
              if (expenseExists) {
                console.log(
                  `✅ Expense "${description}" verified in local state after sync`
                );
              } else {
                console.error(
                  `❌ Expense "${description}" missing from local state after sync!`
                );
              }
            } catch (error) {
              console.error("Failed to sync expense to Firestore:", error);
            }
          }, 100);
        } else {
          console.log("📱 Expense saved locally (no family sync)");
        }
      },

      editExpense: async (
        expenseId: string,
        categoryId: string,
        amount: number,
        description: string,
        date: string
      ) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const expense = state.currentBudget.expenses.find(
            (e) => e.id === expenseId
          );
          if (!expense) return state;

          const updatedExpenses = state.currentBudget.expenses.map((exp) =>
            exp.id === expenseId
              ? {
                  ...exp,
                  categoryId,
                  amount,
                  description,
                  date,
                }
              : exp
          );

          const budgetWithUpdatedExpenses = {
            ...state.currentBudget,
            expenses: updatedExpenses,
          };

          // Recalculate all category spending
          const updatedBudget = recalculateCategorySpending(
            budgetWithUpdatedExpenses
          );

          const updatedHistory = state.budgetHistory.map((budget) =>
            budget.id === state.currentBudget?.id ? updatedBudget : budget
          );

          return {
            currentBudget: updatedBudget,
            budgetHistory: updatedHistory,
          };
        });

        // Auto-sync to Firestore if connected
        if (get().familyId) {
          await get().syncToFirestore();
        }
      },

      deleteExpense: async (expenseId: string) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const expense = state.currentBudget.expenses.find(
            (e) => e.id === expenseId
          );
          if (!expense) return state;

          const updatedExpenses = state.currentBudget.expenses.filter(
            (exp) => exp.id !== expenseId
          );

          const budgetWithUpdatedExpenses = {
            ...state.currentBudget,
            expenses: updatedExpenses,
          };

          // Recalculate all category spending
          const updatedBudget = recalculateCategorySpending(
            budgetWithUpdatedExpenses
          );

          const updatedHistory = state.budgetHistory.map((budget) =>
            budget.id === state.currentBudget?.id ? updatedBudget : budget
          );

          return {
            currentBudget: updatedBudget,
            budgetHistory: updatedHistory,
          };
        });

        // Auto-sync to Firestore if connected
        if (get().familyId) {
          await get().syncToFirestore();
        }
      },

      topupCategory: async (
        fromCategoryId: string,
        toCategoryId: string,
        amount: number
      ) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const fromCategory = state.currentBudget.categories.find(
            (cat) => cat.id === fromCategoryId
          );
          const toCategory = state.currentBudget.categories.find(
            (cat) => cat.id === toCategoryId
          );

          if (!fromCategory || !toCategory) return state;

          const fromRemaining =
            fromCategory.allocatedAmount - fromCategory.spentAmount;
          if (fromRemaining < amount) return state;

          const updatedCategories = state.currentBudget.categories.map(
            (cat) => {
              if (cat.id === fromCategoryId) {
                return {
                  ...cat,
                  allocatedAmount: cat.allocatedAmount - amount,
                };
              }
              if (cat.id === toCategoryId) {
                return {
                  ...cat,
                  allocatedAmount: cat.allocatedAmount + amount,
                };
              }
              return cat;
            }
          );

          const updatedBudget = {
            ...state.currentBudget,
            categories: updatedCategories,
          };

          const updatedHistory = state.budgetHistory.map((budget) =>
            budget.id === state.currentBudget?.id ? updatedBudget : budget
          );

          return {
            currentBudget: updatedBudget,
            budgetHistory: updatedHistory,
          };
        });

        // Auto-sync to Firestore if connected
        if (get().familyId) {
          await get().syncToFirestore();
        }
      },

      getDashboardData: (): DashboardData => {
        const state = get();
        if (!state.currentBudget) {
          return {
            totalBudget: 0,
            totalSpent: 0,
            remainingBudget: 0,
            categoryBreakdown: [],
          };
        }

        // Recalculate spending from actual expenses to ensure accuracy
        const categorySpending = new Map<string, number>();
        state.currentBudget.expenses.forEach((expense) => {
          const currentSpent = categorySpending.get(expense.categoryId) || 0;
          categorySpending.set(
            expense.categoryId,
            currentSpent + expense.amount
          );
        });

        const totalBudget = state.currentBudget.categories.reduce(
          (sum, cat) => sum + cat.allocatedAmount,
          0
        );

        // Calculate total spent from actual expenses, not category.spentAmount
        const totalSpent = Array.from(categorySpending.values()).reduce(
          (sum, amount) => sum + amount,
          0
        );
        const remainingBudget = totalBudget - totalSpent;

        const categoryBreakdown = state.currentBudget.categories.map((cat) => {
          const actualSpent = categorySpending.get(cat.id) || 0;
          return {
            category: cat.name,
            allocated: cat.allocatedAmount,
            spent: actualSpent, // Use calculated value, not stored spentAmount
            remaining: cat.allocatedAmount - actualSpent,
          };
        });

        console.log(
          `📊 Dashboard recalculated: Total spent ${totalSpent} from ${state.currentBudget.expenses.length} expenses`
        );

        return {
          totalBudget,
          totalSpent,
          remainingBudget,
          categoryBreakdown,
        };
      },

      getCurrentMonth: () => {
        const state = get();
        return state.selectedMonth;
      },

      // Debug utility to help track expenses
      debugExpenses: () => {
        const state = get();
        console.log("🔍 DEBUG: Current Store State");
        console.log("Selected Month:", state.selectedMonth);
        console.log("Family ID:", state.familyId);
        console.log("Budget History:", state.budgetHistory.length, "budgets");

        if (state.currentBudget) {
          console.log("Current Budget:", {
            id: state.currentBudget.id,
            month: state.currentBudget.month,
            expenseCount: state.currentBudget.expenses.length,
            totalSpent: state.currentBudget.expenses.reduce(
              (sum, exp) => sum + exp.amount,
              0
            ),
          });

          console.log("Recent Expenses:");
          state.currentBudget.expenses
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .slice(0, 10)
            .forEach((exp, i) => {
              console.log(
                `  ${i + 1}. ${exp.description} - $${exp.amount} (${new Date(
                  exp.date
                ).toLocaleDateString()}) [${exp.id}]`
              );
            });
        } else {
          console.log("No current budget");
        }

        return state;
      },
    }),
    {
      name: "expense-tracker-storage",
      storage: createJSONStorage(() => localStorage),
      // Include family data in persistence
      partialize: (state) => ({
        selectedMonth: state.selectedMonth,
        budgetHistory: state.budgetHistory,
        currentBudget: state.currentBudget,
        familyId: state.familyId,
        currentMember: state.currentMember,
      }),
    }
  )
);

export { predefinedFixedExpenses, getTotalPredefinedFixedExpenses };
