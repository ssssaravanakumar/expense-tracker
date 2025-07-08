export interface BudgetCategory {
  id: string;
  name: string;
  type:
    | "fixed_savings"
    | "variable_savings"
    | "fixed_expenses"
    | "grocery"
    | "unplanned";
  allocatedAmount: number;
  spentAmount: number;
  month: string; // YYYY-MM format
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  isCompleted: boolean;
  dueDate?: string;
  categoryId: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  amount: number;
  description: string;
  date: string;
  type: "manual" | "fixed";
}

export interface MonthlyBudget {
  id: string;
  month: string; // YYYY-MM format
  totalSalary: number;
  categories: BudgetCategory[];
  fixedExpenses: FixedExpense[];
  expenses: Expense[];
  createdAt: string;
}

export interface DashboardData {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  categoryBreakdown: {
    category: string;
    allocated: number;
    spent: number;
    remaining: number;
  }[];
}
