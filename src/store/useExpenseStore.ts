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

interface ExpenseStore {
  currentBudget: MonthlyBudget | null;
  budgetHistory: MonthlyBudget[];

  // Actions
  createMonthlyBudget: (salary: number) => void;
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
  ) => void;
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

export const useExpenseStore = create<ExpenseStore>()(
  persist(
    (set, get) => ({
      currentBudget: null,
      budgetHistory: [],

      getCurrentMonth: () => format(new Date(), "yyyy-MM"),

      createMonthlyBudget: (salary: number) => {
        const currentMonth = get().getCurrentMonth();
        const fixedExpensesCategory = defaultCategories.find(
          (cat) => cat.type === "fixed_expenses"
        );
        const totalPredefinedAmount = getTotalPredefinedFixedExpenses();

        const categories: BudgetCategory[] = defaultCategories.map((cat) => ({
          id: `${cat.type}_${Date.now()}`,
          name: cat.name,
          type: cat.type,
          // Auto-fill Fixed Expenses with predefined total
          allocatedAmount:
            cat.type === "fixed_expenses" ? totalPredefinedAmount : 0,
          spentAmount: 0,
          month: currentMonth,
        }));

        // Auto-add predefined fixed expenses
        const fixedExpensesCategoryId = categories.find(
          (cat) => cat.type === "fixed_expenses"
        )?.id;
        const predefinedExpenses: FixedExpense[] = fixedExpensesCategoryId
          ? predefinedFixedExpenses.map((expense, index) => ({
              id: `predefined_expense_${Date.now()}_${index}`,
              name: expense.name,
              amount: expense.amount,
              isCompleted: false,
              categoryId: fixedExpensesCategoryId,
            }))
          : [];

        const newBudget: MonthlyBudget = {
          id: `budget_${Date.now()}`,
          month: currentMonth,
          totalSalary: salary,
          categories,
          fixedExpenses: predefinedExpenses,
          expenses: [],
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          currentBudget: newBudget,
          budgetHistory: [...state.budgetHistory, newBudget],
        }));
      },

      updateCategoryAllocation: (categoryId: string, amount: number) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const updatedCategories = state.currentBudget.categories.map((cat) =>
            cat.id === categoryId ? { ...cat, allocatedAmount: amount } : cat
          );

          const updatedBudget = {
            ...state.currentBudget,
            categories: updatedCategories,
          };

          return {
            currentBudget: updatedBudget,
            budgetHistory: state.budgetHistory.map((budget) =>
              budget.id === updatedBudget.id ? updatedBudget : budget
            ),
          };
        });
      },

      addFixedExpense: (
        categoryId: string,
        name: string,
        amount: number,
        dueDate?: string
      ) => {
        const expenseId = `expense_${Date.now()}`;

        set((state) => {
          if (!state.currentBudget) return state;

          const newFixedExpense: FixedExpense = {
            id: expenseId,
            name,
            amount,
            isCompleted: false,
            dueDate,
            categoryId,
          };

          const updatedBudget = {
            ...state.currentBudget,
            fixedExpenses: [
              ...state.currentBudget.fixedExpenses,
              newFixedExpense,
            ],
          };

          return {
            currentBudget: updatedBudget,
            budgetHistory: state.budgetHistory.map((budget) =>
              budget.id === updatedBudget.id ? updatedBudget : budget
            ),
          };
        });
      },

      markFixedExpenseComplete: (expenseId: string) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const fixedExpense = state.currentBudget.fixedExpenses.find(
            (exp) => exp.id === expenseId
          );
          if (!fixedExpense) return state;

          // Mark as completed and add to expenses
          const updatedFixedExpenses = state.currentBudget.fixedExpenses.map(
            (exp) =>
              exp.id === expenseId ? { ...exp, isCompleted: true } : exp
          );

          const newExpense: Expense = {
            id: `manual_expense_${Date.now()}`,
            categoryId: fixedExpense.categoryId,
            amount: fixedExpense.amount,
            description: `Fixed expense: ${fixedExpense.name}`,
            date: new Date().toISOString(),
            type: "fixed",
          };

          // Update category spent amount
          const updatedCategories = state.currentBudget.categories.map((cat) =>
            cat.id === fixedExpense.categoryId
              ? { ...cat, spentAmount: cat.spentAmount + fixedExpense.amount }
              : cat
          );

          const updatedBudget = {
            ...state.currentBudget,
            fixedExpenses: updatedFixedExpenses,
            expenses: [...state.currentBudget.expenses, newExpense],
            categories: updatedCategories,
          };

          return {
            currentBudget: updatedBudget,
            budgetHistory: state.budgetHistory.map((budget) =>
              budget.id === updatedBudget.id ? updatedBudget : budget
            ),
          };
        });
      },

      addManualExpense: (
        categoryId: string,
        amount: number,
        description: string,
        date?: string
      ) => {
        set((state) => {
          if (!state.currentBudget) return state;

          const newExpense: Expense = {
            id: `manual_expense_${Date.now()}`,
            categoryId,
            amount,
            description,
            date: date
              ? new Date(date).toISOString()
              : new Date().toISOString(),
            type: "manual",
          };

          // Update category spent amount
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

          return {
            currentBudget: updatedBudget,
            budgetHistory: state.budgetHistory.map((budget) =>
              budget.id === updatedBudget.id ? updatedBudget : budget
            ),
          };
        });
      },

      editExpense: (
        expenseId: string,
        categoryId: string,
        amount: number,
        description: string,
        date: string
      ) => {
        set((state) => {
          if (!state.currentBudget) return state;

          // Find the original expense to calculate category adjustments
          const originalExpense = state.currentBudget.expenses.find(
            (exp) => exp.id === expenseId
          );
          if (!originalExpense) return state;

          // Update the expense
          const updatedExpenses = state.currentBudget.expenses.map((exp) =>
            exp.id === expenseId
              ? { ...exp, categoryId, amount, description, date }
              : exp
          );

          // Recalculate category spent amounts
          const updatedCategories = state.currentBudget.categories.map(
            (cat) => {
              let newSpentAmount = cat.spentAmount;

              // Remove original expense amount from original category
              if (cat.id === originalExpense.categoryId) {
                newSpentAmount -= originalExpense.amount;
              }

              // Add new expense amount to new category
              if (cat.id === categoryId) {
                newSpentAmount += amount;
              }

              return { ...cat, spentAmount: newSpentAmount };
            }
          );

          const updatedBudget = {
            ...state.currentBudget,
            expenses: updatedExpenses,
            categories: updatedCategories,
          };

          return {
            currentBudget: updatedBudget,
            budgetHistory: state.budgetHistory.map((budget) =>
              budget.id === updatedBudget.id ? updatedBudget : budget
            ),
          };
        });
      },

      deleteExpense: (expenseId: string) => {
        set((state) => {
          if (!state.currentBudget) return state;

          // Find the expense to be deleted to adjust category spent amount
          const expenseToDelete = state.currentBudget.expenses.find(
            (exp) => exp.id === expenseId
          );
          if (!expenseToDelete) return state;

          const updatedExpenses = state.currentBudget.expenses.filter(
            (exp) => exp.id !== expenseId
          );

          // Update category spent amount by subtracting the deleted expense
          const updatedCategories = state.currentBudget.categories.map((cat) =>
            cat.id === expenseToDelete.categoryId
              ? {
                  ...cat,
                  spentAmount: cat.spentAmount - expenseToDelete.amount,
                }
              : cat
          );

          const updatedBudget = {
            ...state.currentBudget,
            expenses: updatedExpenses,
            categories: updatedCategories,
          };

          return {
            currentBudget: updatedBudget,
            budgetHistory: state.budgetHistory.map((budget) =>
              budget.id === updatedBudget.id ? updatedBudget : budget
            ),
          };
        });
      },

      topupCategory: (
        fromCategoryId: string,
        toCategoryId: string,
        amount: number
      ) => {
        set((state) => {
          if (!state.currentBudget) return state;

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

          return {
            currentBudget: updatedBudget,
            budgetHistory: state.budgetHistory.map((budget) =>
              budget.id === updatedBudget.id ? updatedBudget : budget
            ),
          };
        });
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

        const categoryBreakdown = state.currentBudget.categories.map((cat) => ({
          category: cat.name,
          allocated: cat.allocatedAmount,
          spent: cat.spentAmount,
          remaining: cat.allocatedAmount - cat.spentAmount,
        }));

        return {
          totalBudget,
          totalSpent,
          remainingBudget: totalBudget - totalSpent,
          categoryBreakdown,
        };
      },
    }),
    {
      name: "expense-tracker-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Export predefined expenses for use in components
export { predefinedFixedExpenses, getTotalPredefinedFixedExpenses };
