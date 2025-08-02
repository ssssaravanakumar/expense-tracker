"use client";

import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useExpenseStore } from "@/store/useExpenseStore";
import { Card, ProgressBar } from "@/components/ui";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export const Dashboard: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getDashboardData, currentBudget, budgetHistory, lastSyncTime } =
    useExpenseStore();

  // Force re-render when budget data changes by subscribing to relevant state
  const [, setRenderKey] = useState(0);

  // Force re-render when expense data might have changed
  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [currentBudget?.expenses?.length, lastSyncTime]);

  const dashboardData = getDashboardData();

  if (!currentBudget) {
    return (
      <div className="p-4 text-center">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <DollarSign className="mx-auto h-12 w-12 text-blue-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Budget Set
          </h3>
          <p className="text-gray-600">
            Create a monthly budget to start tracking your expenses.
          </p>
        </div>
      </div>
    );
  }

  const pieData = dashboardData.categoryBreakdown.map((item, index) => ({
    name: item.category,
    value: item.spent,
    color: COLORS[index % COLORS.length],
  }));

  const barData = dashboardData.categoryBreakdown.map((item) => ({
    category: item.category.replace(" ", "\n"),
    allocated: item.allocated,
    spent: item.spent,
    remaining: item.remaining,
  }));

  const overBudgetCategories = dashboardData.categoryBreakdown.filter(
    (cat) => cat.spent > cat.allocated
  );

  return (
    <div className="p-4 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
            <span className="text-sm font-medium text-gray-600">
              Total Budget
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₹{dashboardData.totalBudget.toLocaleString()}
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex items-center justify-center mb-2">
            <TrendingDown className="h-6 w-6 text-red-600 mr-2" />
            <span className="text-sm font-medium text-gray-600">
              Total Spent
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₹{dashboardData.totalSpent.toLocaleString()}
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-medium text-gray-900">
            Remaining Budget
          </span>
          <span
            className={`text-2xl font-bold ${
              dashboardData.remainingBudget >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            ₹{dashboardData.remainingBudget.toLocaleString()}
          </span>
        </div>
        <ProgressBar
          current={dashboardData.totalSpent}
          total={dashboardData.totalBudget}
          color={
            dashboardData.totalSpent > dashboardData.totalBudget
              ? "red"
              : "blue"
          }
        />
      </Card>

      {/* Over Budget Alert */}
      {overBudgetCategories.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Over Budget Categories
              </h3>
              <div className="mt-2 space-y-1">
                {overBudgetCategories.map((cat) => (
                  <p key={cat.category} className="text-sm text-red-700">
                    {cat.category}: Over by ₹
                    {(cat.spent - cat.allocated).toLocaleString()}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Spending Breakdown Pie Chart */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Spending Breakdown
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `₹${value.toLocaleString()}`,
                  "Spent",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {pieData.map((entry) => (
            <div key={entry.name} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-600 truncate">
                {entry.name}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Category Progress */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Category Progress
        </h3>
        <div className="space-y-4">
          {dashboardData.categoryBreakdown.map((category) => (
            <ProgressBar
              key={category.category}
              current={category.spent}
              total={category.allocated}
              label={category.category}
              color={category.spent > category.allocated ? "red" : "blue"}
            />
          ))}
        </div>
      </Card>

      {/* Budget vs Spent Chart */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Budget vs Spent
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="category"
                fontSize={10}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis fontSize={10} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `₹${value.toLocaleString()}`,
                  name === "allocated"
                    ? "Allocated"
                    : name === "spent"
                    ? "Spent"
                    : "Remaining",
                ]}
              />
              <Bar dataKey="allocated" fill="#8884d8" name="allocated" />
              <Bar dataKey="spent" fill="#82ca9d" name="spent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Month Summary */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Month Summary - {currentBudget.month}
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Total Salary</p>
            <p className="font-medium">
              ₹{currentBudget.totalSalary.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Unallocated</p>
            <p className="font-medium">
              ₹
              {(
                currentBudget.totalSalary - dashboardData.totalBudget
              ).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Total Expenses</p>
            <p className="font-medium">{currentBudget.expenses.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Fixed Expenses</p>
            <p className="font-medium">
              {
                currentBudget.fixedExpenses.filter((exp) => exp.isCompleted)
                  .length
              }
              /{currentBudget.fixedExpenses.length}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
