"use client";

import React, { useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { BudgetSetup } from "@/components/BudgetSetup";
import { ExpenseManager } from "@/components/ExpenseManager";
import { Reports } from "@/components/Reports";
import { FamilySetup } from "@/components/FamilySetup";
import { MonthSelector } from "@/components/MonthSelector";
import { useExpenseStore } from "@/store/useExpenseStore";
import {
  Settings,
  Plus,
  BarChart3,
  FileText,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "budget" | "expenses" | "reports" | "family"
  >("dashboard");
  const {
    currentBudget,
    selectedMonth,
    setSelectedMonth,
    budgetHistory,
    familyId,
    isSyncing,
    syncError,
  } = useExpenseStore();

  // Get available months from budget history
  const availableMonths = budgetHistory.map((budget) => budget.month);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "budget":
        return <BudgetSetup />;
      case "expenses":
        return <ExpenseManager />;
      case "reports":
        return <Reports />;
      case "family":
        return <FamilySetup />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-semibold text-gray-900">
                Expense Tracker
              </h1>

              {/* Sync Status Indicator */}
              {familyId && (
                <div className="flex items-center space-x-1">
                  {isSyncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : syncError ? (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  ) : (
                    <Wifi className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-xs text-gray-600">
                    {isSyncing ? "Syncing..." : familyId ? "Family" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Month Selector on Right */}
            <MonthSelector
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              availableMonths={availableMonths}
            />
          </div>

          {/* Budget Info */}
          {currentBudget && (
            <div className="text-center mt-2">
              <p className="text-sm text-gray-600">
                Monthly Budget: ₹{currentBudget.totalSalary.toLocaleString()}
              </p>
            </div>
          )}

          {/* No Budget Info */}
          {!currentBudget && (
            <div className="text-center mt-2">
              <p className="text-sm text-orange-600">
                No budget set for {selectedMonth}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-screen">
        {!currentBudget ? <BudgetSetup /> : renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === "dashboard"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <BarChart3 className="h-6 w-6" />
            <span className="text-xs mt-1">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("expenses")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === "expenses"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs mt-1">Expenses</span>
          </button>

          <button
            onClick={() => setActiveTab("budget")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === "budget"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Settings className="h-6 w-6" />
            <span className="text-xs mt-1">Budget</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === "reports"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="h-6 w-6" />
            <span className="text-xs mt-1">Reports</span>
          </button>

          <button
            onClick={() => setActiveTab("family")}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === "family"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Users className="h-6 w-6" />
            <span className="text-xs mt-1">Family</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MainApp;
