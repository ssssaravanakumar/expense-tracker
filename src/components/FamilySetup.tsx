"use client";

import React, { useState, useEffect } from "react";
import { useExpenseStore } from "@/store/useExpenseStore";
import { Card, Button, Input } from "@/components/ui";
import {
  Users,
  Plus,
  Copy,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

export const FamilySetup: React.FC = () => {
  const {
    familyId,
    currentMember,
    isInitializing,
    isSyncing,
    syncError,
    lastSyncTime,
    initializeFirestore,
    createOrJoinFamily,
    setMemberName,
    syncToFirestore,
    loadFromFirestore,
  } = useExpenseStore();

  const [joinFamilyId, setJoinFamilyId] = useState("");
  const [memberName, setMemberNameLocal] = useState(currentMember?.name || "");
  const [copied, setCopied] = useState(false);
  const [showSetup, setShowSetup] = useState(!familyId);

  useEffect(() => {
    // Initialize Firestore when component mounts
    if (!familyId && !isInitializing) {
      initializeFirestore();
    }

    // Cleanup function to prevent memory leaks
    return () => {
      // Any cleanup if needed
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty deps to prevent infinite re-renders

  useEffect(() => {
    setMemberNameLocal(currentMember?.name || "");
    setShowSetup(!familyId); // Hide setup when connected to family
  }, [currentMember, familyId]);

  const handleCreateFamily = async () => {
    try {
      await createOrJoinFamily();
      setShowSetup(false);
    } catch (error) {
      console.error("Failed to create family:", error);
    }
  };

  const handleJoinFamily = async () => {
    if (!joinFamilyId.trim()) return;

    try {
      await createOrJoinFamily(joinFamilyId.trim());
      setJoinFamilyId("");
      setShowSetup(false);
    } catch (error) {
      console.error("Failed to join family:", error);
    }
  };

  const handleUpdateMemberName = () => {
    if (memberName.trim()) {
      setMemberName(memberName.trim());
    }
  };

  const handleCopyFamilyId = () => {
    if (familyId) {
      navigator.clipboard.writeText(familyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSyncStatusIcon = () => {
    if (isInitializing || isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />;
    }
    if (syncError) {
      return <WifiOff className="h-4 w-4 text-red-600" />;
    }
    if (familyId) {
      return <Wifi className="h-4 w-4 text-green-600" />;
    }
    return <WifiOff className="h-4 w-4 text-gray-400" />;
  };

  const getSyncStatusText = () => {
    if (isInitializing) return "Initializing...";
    if (isSyncing) return "Syncing...";
    if (syncError) return syncError;
    if (!familyId) return "Not connected to family";
    if (lastSyncTime) {
      return `Last synced: ${new Date(lastSyncTime).toLocaleTimeString()}`;
    }
    return "Connected to family";
  };

  if (showSetup || !familyId) {
    return (
      <div className="p-4 space-y-4">
        <Card>
          <div className="text-center mb-6">
            <Users className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Family Expense Sharing
            </h2>
            <p className="text-gray-600">
              Share your expenses with family members in real-time
            </p>
          </div>

          {/* Member Name Input */}
          <div className="mb-6">
            <Input
              label="Your Name"
              value={memberName}
              onChange={setMemberNameLocal}
              placeholder="Enter your name"
            />
            <Button
              onClick={handleUpdateMemberName}
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={
                !memberName.trim() || memberName === currentMember?.name
              }
            >
              Update Name
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              This name will be shown to other family members
            </p>
          </div>

          {/* Create New Family */}
          <div className="space-y-4">
            <Button
              onClick={handleCreateFamily}
              disabled={isInitializing || isSyncing || !memberName.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isSyncing ? "Creating..." : "Create New Family"}
            </Button>

            <div className="text-center text-gray-500 text-sm">OR</div>

            {/* Join Existing Family */}
            <div className="space-y-2">
              <Input
                label="Family ID"
                value={joinFamilyId}
                onChange={setJoinFamilyId}
                placeholder="Enter family ID to join"
              />
              <Button
                onClick={handleJoinFamily}
                disabled={
                  !joinFamilyId.trim() ||
                  isInitializing ||
                  isSyncing ||
                  !memberName.trim()
                }
                variant="secondary"
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                {isSyncing ? "Joining..." : "Join Family"}
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {syncError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-red-800 text-sm">{syncError}</span>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-1">
              How it works:
            </h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Create a family to start sharing expenses</li>
              <li>• Share the Family ID with other family members</li>
              <li>• All expenses sync automatically across devices</li>
              <li>• No login required - works instantly</li>
            </ul>
          </div>
        </Card>
      </div>
    );
  }

  // Show family connection status
  if (familyId && !showSetup) {
    return (
      <div className="p-4 space-y-4">
        <Card className="border-green-200 bg-green-50">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="text-lg font-medium text-green-900">
                Connected to Family
              </h3>
              <p className="text-sm text-green-700">Family ID: {familyId}</p>
              {currentMember && (
                <p className="text-sm text-green-700">
                  Member: {currentMember.name}
                </p>
              )}
            </div>
          </div>

          {/* Family Management */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <div className="flex space-x-2">
                <Input
                  value={memberName}
                  onChange={(e) => setMemberNameLocal(e)}
                  placeholder="Enter your name"
                  className="flex-1"
                />
                <Button
                  onClick={handleUpdateMemberName}
                  disabled={
                    !memberName.trim() || memberName === currentMember?.name
                  }
                  className="bg-blue-600 text-white"
                >
                  Update Name
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <Button
                onClick={() => setShowSetup(true)}
                className="w-full bg-gray-600 text-white"
              >
                Manage Family Connection
              </Button>
            </div>
          </div>
        </Card>

        {/* Sync Status */}
        {syncError && (
          <Card className="border-red-200 bg-red-50">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-700">{syncError}</span>
            </div>
          </Card>
        )}

        {lastSyncTime && (
          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Last synced: {new Date(lastSyncTime).toLocaleString()}
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Family is connected - show status
  return (
    <div className="p-4 space-y-4">
      <Card className="bg-green-50 border-green-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-lg font-medium text-green-800">
              Family Connected
            </h3>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            {getSyncStatusIcon()}
            <span
              className={`${syncError ? "text-red-600" : "text-green-600"}`}
            >
              {getSyncStatusText()}
            </span>
          </div>
        </div>

        {/* Family ID */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Family ID (Share with others)
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md font-mono text-sm">
                {familyId}
              </div>
              <Button
                onClick={handleCopyFamilyId}
                size="sm"
                variant="secondary"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Share this ID with family members so they can join
            </p>
          </div>

          {/* Member Name */}
          <div>
            <Input
              label="Your Name"
              value={memberName}
              onChange={setMemberNameLocal}
            />
            <Button
              onClick={handleUpdateMemberName}
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={
                !memberName.trim() || memberName === currentMember?.name
              }
            >
              Update Name
            </Button>
          </div>
        </div>

        {/* Manual Sync Actions */}
        <div className="flex space-x-2 mt-4">
          <Button
            onClick={syncToFirestore}
            disabled={isSyncing}
            size="sm"
            variant="secondary"
            className="flex-1"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
            />
            Push to Cloud
          </Button>

          <Button
            onClick={loadFromFirestore}
            disabled={isSyncing}
            size="sm"
            variant="secondary"
            className="flex-1"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
            />
            Pull from Cloud
          </Button>
        </div>

        {/* Setup Button */}
        <Button
          onClick={() => setShowSetup(true)}
          variant="outline"
          size="sm"
          className="w-full mt-3"
        >
          Change Family Settings
        </Button>
      </Card>

      {/* Real-time Status */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-center">
          <Wifi className="h-4 w-4 text-blue-600 mr-2" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              Real-time Sync Active
            </h4>
            <p className="text-xs text-blue-600">
              Expenses are automatically shared across all family devices
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
