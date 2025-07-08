"use client";

import React, { useState, useMemo } from "react";
import { useExpenseStore } from "@/store/useExpenseStore";
import { Card, Button, Input, Select } from "@/components/ui";
import {
  Calendar,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from "date-fns";

export const Reports: React.FC = () => {
  const { currentBudget } = useExpenseStore();
  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expenseType, setExpenseType] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "category">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...currentBudget.categories.map((cat) => ({
      value: cat.id,
      label: cat.name,
    })),
  ];

  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "manual", label: "Manual Expenses" },
    { value: "fixed", label: "Fixed Expenses" },
  ];

  const filteredExpenses = useMemo(() => {
    let expenses = currentBudget.expenses;

    // Date filter
    if (dateFrom && dateTo) {
      const fromDate = parseISO(dateFrom);
      const toDate = parseISO(dateTo);
      expenses = expenses.filter((expense) =>
        isWithinInterval(parseISO(expense.date), {
          start: fromDate,
          end: toDate,
        })
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      expenses = expenses.filter(
        (expense) => expense.categoryId === selectedCategory
      );
    }

    // Type filter
    if (expenseType !== "all") {
      expenses = expenses.filter((expense) => expense.type === expenseType);
    }

    // Sort expenses
    expenses.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "category":
          const catA =
            currentBudget.categories.find((c) => c.id === a.categoryId)?.name ||
            "";
          const catB =
            currentBudget.categories.find((c) => c.id === b.categoryId)?.name ||
            "";
          comparison = catA.localeCompare(catB);
          break;
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

    return expenses;
  }, [
    currentBudget.expenses,
    dateFrom,
    dateTo,
    selectedCategory,
    expenseType,
    sortBy,
    sortOrder,
    currentBudget.categories,
  ]);

  const reportSummary = useMemo(() => {
    const totalAmount = filteredExpenses.reduce(
      (sum, exp) => sum + exp.amount,
      0
    );
    const expenseCount = filteredExpenses.length;
    const avgExpense = expenseCount > 0 ? totalAmount / expenseCount : 0;

    const categoryBreakdown = currentBudget.categories
      .map((category) => {
        const categoryExpenses = filteredExpenses.filter(
          (exp) => exp.categoryId === category.id
        );
        const categoryTotal = categoryExpenses.reduce(
          (sum, exp) => sum + exp.amount,
          0
        );
        return {
          category: category.name,
          amount: categoryTotal,
          count: categoryExpenses.length,
          percentage: totalAmount > 0 ? (categoryTotal / totalAmount) * 100 : 0,
        };
      })
      .filter((item) => item.amount > 0);

    const typeBreakdown = {
      manual: filteredExpenses
        .filter((exp) => exp.type === "manual")
        .reduce((sum, exp) => sum + exp.amount, 0),
      fixed: filteredExpenses
        .filter((exp) => exp.type === "fixed")
        .reduce((sum, exp) => sum + exp.amount, 0),
    };

    return {
      totalAmount,
      expenseCount,
      avgExpense,
      categoryBreakdown,
      typeBreakdown,
    };
  }, [filteredExpenses, currentBudget.categories]);

  const exportToCSV = () => {
    const headers = ["Date", "Category", "Description", "Amount", "Type"];
    const csvData = filteredExpenses.map((expense) => {
      const category = currentBudget.categories.find(
        (c) => c.id === expense.categoryId
      );
      return [
        format(parseISO(expense.date), "yyyy-MM-dd"),
        category?.name || "Unknown",
        expense.description,
        expense.amount,
        expense.type,
      ];
    });

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Expense Reports
        </h2>

        {/* Filters */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={setDateFrom}
            />
            <Input
              label="To Date"
              type="date"
              value={dateTo}
              onChange={setDateTo}
            />
          </div>

          <Select
            label="Category"
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categoryOptions}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={expenseType}
              onChange={setExpenseType}
              options={typeOptions}
            />
            <Select
              label="Sort By"
              value={sortBy}
              onChange={(value) =>
                setSortBy(value as "date" | "amount" | "category")
              }
              options={[
                { value: "date", label: "Date" },
                { value: "amount", label: "Amount" },
                { value: "category", label: "Category" },
              ]}
            />
          </div>

          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {sortOrder === "asc" ? "Ascending" : "Descending"}
            </Button>
            <Button
              size="sm"
              onClick={exportToCSV}
              disabled={filteredExpenses.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Total Amount</p>
            <p className="text-xl font-bold text-blue-900">
              ₹{reportSummary.totalAmount.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Total Expenses</p>
            <p className="text-xl font-bold text-green-900">
              {reportSummary.expenseCount}
            </p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg col-span-2">
            <p className="text-sm text-purple-600">Average Expense</p>
            <p className="text-xl font-bold text-purple-900">
              ₹{reportSummary.avgExpense.toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      {/* Category Breakdown */}
      {reportSummary.categoryBreakdown.length > 0 && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Category Breakdown
          </h3>
          <div className="space-y-3">
            {reportSummary.categoryBreakdown.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.category}</p>
                  <p className="text-sm text-gray-600">{item.count} expenses</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    ₹{item.amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {item.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Expense List */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Expenses ({filteredExpenses.length})
        </h3>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-8">
            <Filter className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">
              No expenses found for the selected filters.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredExpenses.map((expense) => {
              const category = currentBudget.categories.find(
                (c) => c.id === expense.categoryId
              );
              return (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {expense.description}
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span>{category?.name}</span>
                      <span>•</span>
                      <span>
                        {format(parseISO(expense.date), "MMM dd, yyyy")}
                      </span>
                      <span>•</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          expense.type === "fixed"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {expense.type === "fixed" ? "Fixed" : "Manual"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ₹{expense.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
