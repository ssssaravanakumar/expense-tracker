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
          await firestoreService.initialize();
          const familyId = firestoreService.getFamilyId();
          const currentMember = firestoreService.getCurrentMember();

          set({
            familyId,
            currentMember,
            isInitializing: false,
          });

          // Only set up listener if we have a family and don't already have one
          if (familyId && !state.isListenerActive) {
            set({ isListenerActive: true });

            // Set up real-time listener
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

            // Load initial data only once
            await get().loadFromFirestore();
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
          const budgets = await firestoreService.getBudgets();
          const currentBudget = budgets.find(
            (b) => b.month === state.selectedMonth
          );

          set({
            budgetHistory: budgets,
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
          if (!fixedExpense || fixedExpense.isCompleted) return state;

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

          const updatedCategories = state.currentBudget.categories.map((cat) =>
            cat.id === fixedExpense.categoryId
              ? { ...cat, spentAmount: cat.spentAmount + fixedExpense.amount }
              : cat
          );

          const updatedBudget = {
            ...state.currentBudget,
            fixedExpenses: updatedFixedExpenses,
            expenses: [...state.currentBudget.expenses, newManualExpense],
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

      addManualExpense: async (
        categoryId: string,
        amount: number,
        description: string,
        date?: string
      ) => {
        const expenseId = `expense_${Date.now()}_${Math.random()}`;
        const newExpense: Expense = {
          id: expenseId,
          categoryId,
          amount,
          description,
          date: date || new Date().toISOString(),
          type: "manual",
        };

        set((state) => {
          if (!state.currentBudget) return state;

          const updatedCategories = state.currentBudget.categories.map((cat) =>
            cat.id === categoryId
              ? { ...cat, spentAmount: cat.spentAmount + amount }
              : cat
          );

          const updatedBudget = {
            ...state.currentBudget,
            expenses: [...state.currentBudget.expenses, newExpense],
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

          const oldAmount = expense.amount;
          const oldCategoryId = expense.categoryId;

          const updatedExpenses = state.currentBudget.expenses.map((exp) =>
            exp.id === expenseId
              ? { ...exp, categoryId, amount, description, date }
              : exp
          );

          const updatedCategories = state.currentBudget.categories.map(
            (cat) => {
              if (cat.id === oldCategoryId) {
                return { ...cat, spentAmount: cat.spentAmount - oldAmount };
              }
              if (cat.id === categoryId) {
                return { ...cat, spentAmount: cat.spentAmount + amount };
              }
              return cat;
            }
          );

          const updatedBudget = {
            ...state.currentBudget,
            expenses: updatedExpenses,
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

          const updatedCategories = state.currentBudget.categories.map((cat) =>
            cat.id === expense.categoryId
              ? { ...cat, spentAmount: cat.spentAmount - expense.amount }
              : cat
          );

          const updatedBudget = {
            ...state.currentBudget,
            expenses: updatedExpenses,
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

        const totalBudget = state.currentBudget.categories.reduce(
          (sum, cat) => sum + cat.allocatedAmount,
          0
        );
        const totalSpent = state.currentBudget.categories.reduce(
          (sum, cat) => sum + cat.spentAmount,
          0
        );
        const remainingBudget = totalBudget - totalSpent;

        const categoryBreakdown = state.currentBudget.categories.map((cat) => ({
          category: cat.name,
          allocated: cat.allocatedAmount,
          spent: cat.spentAmount,
          remaining: cat.allocatedAmount - cat.spentAmount,
        }));

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
    }),
    {
      name: "expense-tracker-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist core data, not sync state
      partialize: (state) => ({
        selectedMonth: state.selectedMonth,
        budgetHistory: state.budgetHistory,
        currentBudget: state.currentBudget,
      }),
    }
  )
);

export { predefinedFixedExpenses, getTotalPredefinedFixedExpenses };
