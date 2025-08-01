"use client";

import React, { useState } from "react";
import {
  useExpenseStore,
  predefinedFixedExpenses,
  getTotalPredefinedFixedExpenses,
} from "@/store/useExpenseStore";
import { Card, Button, Input } from "@/components/ui";

import { DollarSign, Edit3 } from "lucide-react";
import { format, parseISO } from "date-fns";

export const BudgetSetup: React.FC = () => {
  const {
    currentBudget,
    selectedMonth,
    createMonthlyBudget,
    updateCategoryAllocation,
  } = useExpenseStore();
  const [salary, setSalary] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const handleCreateBudget = () => {
    if (salary && parseFloat(salary) > 0) {
      createMonthlyBudget(parseFloat(salary), selectedMonth);
      setSalary("");
    }
  };

  const handleUpdateAllocation = (categoryId: string) => {
    if (editAmount && parseFloat(editAmount) >= 0) {
      updateCategoryAllocation(categoryId, parseFloat(editAmount));
      setEditingCategory(null);
      setEditAmount("");
    }
  };

  const startEditing = (categoryId: string, currentAmount: number) => {
    setEditingCategory(categoryId);
    setEditAmount(currentAmount.toString());
  };

  const totalAllocated =
    currentBudget?.categories.reduce(
      (sum, cat) => sum + cat.allocatedAmount,
      0
    ) || 0;
  const remainingSalary = currentBudget
    ? currentBudget.totalSalary - totalAllocated
    : 0;

  const formatDisplayMonth = (month: string) => {
    return format(parseISO(month + "-01"), "MMMM yyyy");
  };

  if (!currentBudget) {
    return (
      <div className="p-4 space-y-4">
        <Card>
          <div className="text-center mb-6">
            <DollarSign className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Setup Monthly Budget
            </h2>
            <p className="text-gray-600">
              Enter your salary for {formatDisplayMonth(selectedMonth)} to get
              started
            </p>
          </div>

          <Input
            label="Monthly Salary"
            type="number"
            value={salary}
            onChange={setSalary}
            placeholder="Enter your monthly salary"
            required
          />

          <Button
            onClick={handleCreateBudget}
            disabled={!salary || parseFloat(salary) <= 0}
            className="w-full"
          >
            Create Budget for {formatDisplayMonth(selectedMonth)}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Budget for {currentBudget.month}
          </h2>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Salary</p>
            <p className="text-lg font-bold text-gray-900">
              ₹{currentBudget.totalSalary.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-600">Allocated</p>
            <p className="text-lg font-semibold text-blue-900">
              ₹{totalAllocated.toLocaleString()}
            </p>
          </div>
          <div
            className={`p-3 rounded-lg ${
              remainingSalary >= 0 ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <p
              className={`text-sm ${
                remainingSalary >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              Remaining
            </p>
            <p
              className={`text-lg font-semibold ${
                remainingSalary >= 0 ? "text-green-900" : "text-red-900"
              }`}
            >
              ₹{remainingSalary.toLocaleString()}
            </p>
          </div>
        </div>

        {remainingSalary < 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">
              ⚠️ You have over-allocated by ₹
              {Math.abs(remainingSalary).toLocaleString()}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Budget Categories
        </h3>
        <div className="space-y-3">
          {currentBudget.categories.map((category) => (
            <div
              key={category.id}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{category.name}</h4>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    startEditing(category.id, category.allocatedAmount)
                  }
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>

              {editingCategory === category.id ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    value={editAmount}
                    onChange={setEditAmount}
                    placeholder="Enter amount"
                  />
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateAllocation(category.id)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingCategory(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Allocated:</span>
                  <span className="font-medium">
                    ₹{category.allocatedAmount.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Spent:</span>
                <span
                  className={`font-medium ${
                    category.spentAmount > category.allocatedAmount
                      ? "text-red-600"
                      : "text-gray-900"
                  }`}
                >
                  ₹{category.spentAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Remaining:</span>
                <span
                  className={`font-medium ${
                    category.allocatedAmount - category.spentAmount >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ₹
                  {(
                    category.allocatedAmount - category.spentAmount
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Quick Allocation Tips
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• Fixed Savings: 20-30% of salary for long-term goals</p>
          <p>• Variable Savings: 10-15% for emergency fund</p>
          <p>• Fixed Expenses: 30-40% for rent, utilities, EMIs</p>
          <p>• Grocery: 10-15% for monthly food expenses</p>
          <p>• Unplanned: 5-10% for entertainment and misc</p>
        </div>
      </Card>

      {/* Predefined Fixed Expenses Info */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Predefined Fixed Expenses
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800 mb-2">
            ✨ Fixed Expenses category is auto-filled with your predefined
            expenses:
          </p>
          <p className="text-lg font-bold text-blue-900">
            Total: ₹{getTotalPredefinedFixedExpenses().toLocaleString()}
          </p>
        </div>

        <div className="space-y-2">
          {predefinedFixedExpenses.map((expense, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
            >
              <span className="text-gray-900">{expense.name}</span>
              <span className="font-medium text-gray-900">
                ₹{expense.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            💡 These expenses are automatically added to your Fixed Expenses
            when you create a budget. You can mark them as completed when you
            pay them.
          </p>
        </div>
      </Card>
    </div>
  );
};
