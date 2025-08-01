"use client";

import React, { useState } from "react";
import {
  useExpenseStore,
  predefinedFixedExpenses,
} from "@/store/useExpenseStore";
import { Card, Button, Input, Select } from "@/components/ui";
import { Plus, ArrowUpDown, Edit3, Trash2, Save, X } from "lucide-react";
import { format } from "date-fns";

export const ExpenseManager: React.FC = () => {
  const {
    currentBudget,
    addManualExpense,
    topupCategory,
    editExpense,
    deleteExpense,
  } = useExpenseStore();

  const [activeTab, setActiveTab] = useState<"expenses" | "topup">("expenses");

  // Edit expense state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseCategory, setEditExpenseCategory] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseDescription, setEditExpenseDescription] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");

  // Fixed expense form state
  const [fixedExpenseName, setFixedExpenseName] = useState("");
  const [fixedExpenseAmount, setFixedExpenseAmount] = useState("");
  const [fixedExpenseCategory, setFixedExpenseCategory] = useState("");
  const [fixedExpenseDueDate, setFixedExpenseDueDate] = useState("");
  const [selectedPredefinedExpense, setSelectedPredefinedExpense] =
    useState("");

  // Manual expense form state
  const [manualExpenseAmount, setManualExpenseAmount] = useState("");
  const [manualExpenseDescription, setManualExpenseDescription] = useState("");
  const [manualExpenseCategory, setManualExpenseCategory] = useState("");
  const [manualExpenseDate, setManualExpenseDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  // Topup form state
  const [fromCategory, setFromCategory] = useState("");
  const [toCategory, setToCategory] = useState("");
  const [topupAmount, setTopupAmount] = useState("");

  if (!currentBudget) {
    return (
      <div className="p-4 text-center">
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Budget Found
          </h3>
          <p className="text-gray-600">
            Please set up your monthly budget first.
          </p>
        </Card>
      </div>
    );
  }

  const categoryOptions = currentBudget.categories.map((cat) => ({
    value: cat.id,
    label: cat.name,
  }));

  const topupFromOptions = currentBudget.categories
    .filter(
      (cat) =>
        cat.type === "variable_savings" && cat.allocatedAmount > cat.spentAmount
    )
    .map((cat) => ({
      value: cat.id,
      label: `${cat.name} (₹${(
        cat.allocatedAmount - cat.spentAmount
      ).toLocaleString()} available)`,
    }));

  const topupToOptions = currentBudget.categories
    .filter((cat) => cat.type !== "variable_savings")
    .map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));

  // Create options for predefined expenses
  const predefinedExpenseOptions = [
    { value: "", label: "Select predefined expense" },
    ...predefinedFixedExpenses.map((expense) => ({
      value: expense.name,
      label: `${expense.name} (₹${expense.amount.toLocaleString()})`,
    })),
    { value: "other", label: "Other (Custom Expense)" },
  ];

  // Handle predefined expense selection
  const handlePredefinedExpenseSelect = (value: string) => {
    setSelectedPredefinedExpense(value);
    if (value && value !== "other") {
      const selectedExpense = predefinedFixedExpenses.find(
        (exp) => exp.name === value
      );
      if (selectedExpense) {
        setFixedExpenseName(selectedExpense.name);
        setFixedExpenseAmount(selectedExpense.amount.toString());
      }
    } else if (value === "other") {
      setFixedExpenseName("");
      setFixedExpenseAmount("");
    } else {
      setFixedExpenseName("");
      setFixedExpenseAmount("");
    }
  };

  const handleAddManualExpense = async () => {
    if (
      manualExpenseAmount &&
      manualExpenseDescription &&
      manualExpenseCategory
    ) {
      try {
        await addManualExpense(
          manualExpenseCategory,
          parseFloat(manualExpenseAmount),
          manualExpenseDescription,
          manualExpenseDate || undefined
        );
        // Reset form only after successful sync
        setManualExpenseCategory("");
        setManualExpenseAmount("");
        setManualExpenseDescription("");
        setManualExpenseDate(format(new Date(), "yyyy-MM-dd")); // Reset to current date
      } catch (error) {
        console.error("Failed to add expense:", error);
      }
    }
  };

  const handleTopup = () => {
    if (fromCategory && toCategory && topupAmount) {
      topupCategory(fromCategory, toCategory, parseFloat(topupAmount));
      setFromCategory("");
      setToCategory("");
      setTopupAmount("");
    }
  };

  const handleEditExpense = () => {
    if (
      editingExpenseId &&
      editExpenseCategory &&
      editExpenseAmount &&
      editExpenseDescription &&
      editExpenseDate
    ) {
      editExpense(
        editingExpenseId,
        editExpenseCategory,
        parseFloat(editExpenseAmount),
        editExpenseDescription,
        new Date(editExpenseDate).toISOString()
      );
      setEditingExpenseId(null);
      setEditExpenseCategory("");
      setEditExpenseAmount("");
      setEditExpenseDescription("");
      setEditExpenseDate("");
    }
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setEditExpenseCategory("");
    setEditExpenseAmount("");
    setEditExpenseDescription("");
    setEditExpenseDate("");
  };

  const handleDeleteExpense = (expenseId: string) => {
    deleteExpense(expenseId);
  };

  const recentExpenses = currentBudget.expenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="p-4 space-y-4">
      {/* Tab Navigation */}
      <Card>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "expenses"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setActiveTab("topup")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "topup"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            💰 Transfer Budget
          </button>
        </div>
      </Card>

      {/* Unified Expense Form */}
      {activeTab === "expenses" && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingExpenseId ? "Edit Expense" : "Add Expense"}
          </h3>

          <Select
            label="Category"
            value={manualExpenseCategory || fixedExpenseCategory}
            onChange={(value) => {
              setManualExpenseCategory(value);
              setFixedExpenseCategory(value);
              // Reset form when category changes
              setSelectedPredefinedExpense("");
              setFixedExpenseName("");
              setFixedExpenseAmount("");
              setManualExpenseAmount("");
              setManualExpenseDescription("");
            }}
            options={categoryOptions}
            placeholder="Select category"
            required
          />

          {/* Show predefined expenses dropdown only for Fixed Expenses category */}
          {currentBudget.categories.find(
            (cat) => cat.id === (manualExpenseCategory || fixedExpenseCategory)
          )?.type === "fixed_expenses" && (
            <Select
              label="Predefined Expenses"
              value={selectedPredefinedExpense}
              onChange={handlePredefinedExpenseSelect}
              options={predefinedExpenseOptions}
              placeholder="Select predefined expense"
            />
          )}

          {/* Show Expense Name field only for non-Fixed Expenses OR when "Other" is selected in Fixed Expenses */}
          {(currentBudget.categories.find(
            (cat) => cat.id === (manualExpenseCategory || fixedExpenseCategory)
          )?.type !== "fixed_expenses" ||
            selectedPredefinedExpense === "other") && (
            <Input
              label={
                currentBudget.categories.find(
                  (cat) =>
                    cat.id === (manualExpenseCategory || fixedExpenseCategory)
                )?.type === "fixed_expenses"
                  ? "Expense Name"
                  : "Description"
              }
              type="text"
              value={
                currentBudget.categories.find(
                  (cat) =>
                    cat.id === (manualExpenseCategory || fixedExpenseCategory)
                )?.type === "fixed_expenses"
                  ? fixedExpenseName
                  : manualExpenseDescription
              }
              onChange={(value) => {
                if (
                  currentBudget.categories.find(
                    (cat) =>
                      cat.id === (manualExpenseCategory || fixedExpenseCategory)
                  )?.type === "fixed_expenses"
                ) {
                  setFixedExpenseName(value);
                } else {
                  setManualExpenseDescription(value);
                }
              }}
              placeholder={
                currentBudget.categories.find(
                  (cat) =>
                    cat.id === (manualExpenseCategory || fixedExpenseCategory)
                )?.type === "fixed_expenses"
                  ? "e.g., Electricity Bill, Rent"
                  : "What did you spend on?"
              }
              required
            />
          )}

          <Input
            label="Amount"
            type="number"
            value={
              currentBudget.categories.find(
                (cat) =>
                  cat.id === (manualExpenseCategory || fixedExpenseCategory)
              )?.type === "fixed_expenses"
                ? fixedExpenseAmount
                : manualExpenseAmount
            }
            onChange={(value) => {
              if (
                currentBudget.categories.find(
                  (cat) =>
                    cat.id === (manualExpenseCategory || fixedExpenseCategory)
                )?.type === "fixed_expenses"
              ) {
                setFixedExpenseAmount(value);
              } else {
                setManualExpenseAmount(value);
              }
            }}
            placeholder="Enter amount"
            required
          />

          {/* Show Date field for manual expenses, Due Date for fixed expenses */}
          <Input
            label={
              currentBudget.categories.find(
                (cat) =>
                  cat.id === (manualExpenseCategory || fixedExpenseCategory)
              )?.type === "fixed_expenses"
                ? "Due Date (Optional)"
                : "Date"
            }
            type="date"
            value={
              currentBudget.categories.find(
                (cat) =>
                  cat.id === (manualExpenseCategory || fixedExpenseCategory)
              )?.type === "fixed_expenses"
                ? fixedExpenseDueDate
                : manualExpenseDate
            }
            onChange={(value) => {
              if (
                currentBudget.categories.find(
                  (cat) =>
                    cat.id === (manualExpenseCategory || fixedExpenseCategory)
                )?.type === "fixed_expenses"
              ) {
                setFixedExpenseDueDate(value);
              } else {
                setManualExpenseDate(value);
              }
            }}
            required={
              currentBudget.categories.find(
                (cat) =>
                  cat.id === (manualExpenseCategory || fixedExpenseCategory)
              )?.type !== "fixed_expenses"
            }
          />

          <Button
            onClick={() => {
              const selectedCategory = currentBudget.categories.find(
                (cat) =>
                  cat.id === (manualExpenseCategory || fixedExpenseCategory)
              );
              if (selectedCategory?.type === "fixed_expenses") {
                // For fixed expenses, add directly as a manual expense instead of creating a fixed expense
                if (fixedExpenseName && fixedExpenseAmount) {
                  const expenseDate = fixedExpenseDueDate
                    ? new Date(fixedExpenseDueDate)
                    : new Date();
                  addManualExpense(
                    fixedExpenseCategory,
                    parseFloat(fixedExpenseAmount),
                    fixedExpenseName,
                    expenseDate.toISOString()
                  );
                  setFixedExpenseName("");
                  setFixedExpenseAmount("");
                  setFixedExpenseCategory("");
                  setFixedExpenseDueDate("");
                  setSelectedPredefinedExpense("");
                  setManualExpenseCategory("");
                }
              } else {
                handleAddManualExpense();
              }
            }}
            disabled={
              !(manualExpenseCategory || fixedExpenseCategory) ||
              !(currentBudget.categories.find(
                (cat) =>
                  cat.id === (manualExpenseCategory || fixedExpenseCategory)
              )?.type === "fixed_expenses"
                ? fixedExpenseName && fixedExpenseAmount
                : manualExpenseAmount && manualExpenseDescription)
            }
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {editingExpenseId ? "Update Expense" : "Add Expense"}
          </Button>

          {/* Edit Expense Section */}
          {editingExpenseId && (
            <div className="mt-4 p-4 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Edit Expense
              </h4>

              <Select
                label="Category"
                value={editExpenseCategory}
                onChange={setEditExpenseCategory}
                options={categoryOptions}
                placeholder="Select category"
                required
              />

              <Input
                label="Amount"
                type="number"
                value={editExpenseAmount}
                onChange={setEditExpenseAmount}
                placeholder="Enter amount"
                required
              />

              <Input
                label="Description"
                type="text"
                value={editExpenseDescription}
                onChange={setEditExpenseDescription}
                placeholder="Enter description"
                required
              />

              <Input
                label="Date"
                type="date"
                value={editExpenseDate}
                onChange={setEditExpenseDate}
                placeholder="Select date"
                required
              />

              <div className="flex space-x-2 mt-2">
                <Button
                  onClick={handleEditExpense}
                  disabled={!editExpenseCategory || !editExpenseAmount}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  onClick={cancelEdit}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Topup Form */}
      {activeTab === "topup" && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            <ArrowUpDown className="h-5 w-5 inline mr-2" />
            Transfer Budget
          </h3>

          {topupFromOptions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-600">
                No available funds in Variable Savings to transfer.
              </p>
            </div>
          ) : (
            <>
              <Select
                label="Transfer From"
                value={fromCategory}
                onChange={setFromCategory}
                options={topupFromOptions}
                placeholder="Select source category"
                required
              />

              <Select
                label="Transfer To"
                value={toCategory}
                onChange={setToCategory}
                options={topupToOptions}
                placeholder="Select destination category"
                required
              />

              <Input
                label="Amount"
                type="number"
                value={topupAmount}
                onChange={setTopupAmount}
                placeholder="Enter amount to transfer"
                required
              />

              <Button
                onClick={handleTopup}
                disabled={!fromCategory || !toCategory || !topupAmount}
                className="w-full"
              >
                Transfer Budget
              </Button>
            </>
          )}
        </Card>
      )}

      {/* Recent Expenses */}
      {recentExpenses.length > 0 && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Recent Expenses
          </h3>
          <div className="space-y-2">
            {recentExpenses.map((expense) => {
              const category = currentBudget.categories.find(
                (cat) => cat.id === expense.categoryId
              );
              return (
                <div
                  key={expense.id}
                  className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {expense.description}
                    </p>
                    <p className="text-sm text-gray-600">
                      {category?.name} •{" "}
                      {format(new Date(expense.date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-gray-900">
                      ₹{expense.amount.toLocaleString()}
                    </span>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingExpenseId(expense.id);
                          setEditExpenseCategory(expense.categoryId);
                          setEditExpenseAmount(expense.amount.toString());
                          setEditExpenseDescription(expense.description);
                          setEditExpenseDate(
                            format(new Date(expense.date), "yyyy-MM-dd")
                          );
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this expense?"
                            )
                          ) {
                            handleDeleteExpense(expense.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
