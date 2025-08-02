import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { MonthlyBudget, Expense } from "@/types";

export interface FamilyData {
  id: string;
  budgets: FirestoreBudget[];
  lastUpdated: Timestamp;
  lastUpdatedBy: string;
  familyName?: string;
  members: FamilyMember[];
}

export interface FamilyMember {
  id: string;
  name: string;
  deviceInfo: string;
  lastSeen: Timestamp;
  isOnline: boolean;
}

export interface FirestoreExpense extends Omit<Expense, "date"> {
  date: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreBudget
  extends Omit<MonthlyBudget, "createdAt" | "expenses"> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expenses: FirestoreExpense[];
}

class FirestoreService {
  private familyId: string | null = null;
  private memberId: string;
  private memberName: string;
  private unsubscribeFunctions: Unsubscribe[] = [];
  private isSubscribed: boolean = false; // Add flag to prevent duplicate subscriptions

  constructor() {
    this.memberId = this.generateMemberId();
    this.memberName = this.getMemberName();
  }

  // Generate unique member ID for this device/session
  private generateMemberId(): string {
    if (typeof window === "undefined") return "ssr_member"; // SSR fallback

    let memberId = localStorage.getItem("expense_tracker_member_id");
    if (!memberId) {
      memberId = `member_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      localStorage.setItem("expense_tracker_member_id", memberId);
    }
    return memberId;
  }

  // Get or set member name
  private getMemberName(): string {
    if (typeof window === "undefined") return "SSR User"; // SSR fallback

    let memberName = localStorage.getItem("expense_tracker_member_name");
    if (!memberName) {
      // Generate a default name or prompt user
      memberName = `Family Member ${Math.floor(Math.random() * 100)}`;
      localStorage.setItem("expense_tracker_member_name", memberName);
    }
    return memberName;
  }

  // Set member name
  setMemberName(name: string): void {
    this.memberName = name;
    if (typeof window !== "undefined") {
      localStorage.setItem("expense_tracker_member_name", name);
    }
    this.updateMemberInfo();
  }

  // Create or join a family
  async createOrJoinFamily(familyId?: string): Promise<string> {
    try {
      if (familyId) {
        // Join existing family
        const familyDoc = await getDoc(doc(db, "families", familyId));
        if (familyDoc.exists()) {
          this.familyId = familyId;
          if (typeof window !== "undefined") {
            localStorage.setItem("expense_tracker_family_id", familyId);
          }
          await this.updateMemberInfo();
          return familyId;
        } else {
          throw new Error("Family not found");
        }
      } else {
        // Create new family
        const newFamilyId = `family_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        const familyData: FamilyData = {
          id: newFamilyId,
          budgets: [],
          lastUpdated: Timestamp.now(),
          lastUpdatedBy: this.memberId,
          familyName: "Family Expenses",
          members: [
            {
              id: this.memberId,
              name: this.memberName,
              deviceInfo: navigator.userAgent,
              lastSeen: Timestamp.now(),
              isOnline: true,
            },
          ],
        };

        await setDoc(doc(db, "families", newFamilyId), familyData);
        this.familyId = newFamilyId;
        if (typeof window !== "undefined") {
          localStorage.setItem("expense_tracker_family_id", newFamilyId);
        }
        return newFamilyId;
      }
    } catch (error) {
      console.error("Error creating/joining family:", error);
      throw error;
    }
  }

  // Update member info and mark as online
  private async updateMemberInfo(): Promise<void> {
    if (!this.familyId) return;

    try {
      const familyRef = doc(db, "families", this.familyId);
      const familyDoc = await getDoc(familyRef);

      if (familyDoc.exists()) {
        const data = familyDoc.data() as FamilyData;
        const members = data.members || [];

        // Update existing member or add new one
        const memberIndex = members.findIndex((m) => m.id === this.memberId);
        const memberInfo: FamilyMember = {
          id: this.memberId,
          name: this.memberName,
          deviceInfo: navigator.userAgent,
          lastSeen: Timestamp.now(),
          isOnline: true,
        };

        if (memberIndex >= 0) {
          members[memberIndex] = memberInfo;
        } else {
          members.push(memberInfo);
        }

        await setDoc(familyRef, {
          ...data,
          members,
          lastUpdated: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error("Error updating member info:", error);
    }
  }

  // Get current family ID
  getFamilyId(): string | null {
    // First check instance variable
    if (this.familyId) {
      return this.familyId;
    }

    // Then check localStorage if in browser
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("expense_tracker_family_id");
      if (stored) {
        this.familyId = stored;
        console.log("📱 Retrieved family ID from localStorage:", stored);
        return stored;
      }
    }

    return null;
  }

  // Convert local budget to Firestore format
  private budgetToFirestore(budget: MonthlyBudget): FirestoreBudget {
    return {
      ...budget,
      createdAt: budget.createdAt
        ? Timestamp.fromDate(new Date(budget.createdAt))
        : Timestamp.now(),
      updatedAt: Timestamp.now(),
      expenses: budget.expenses.map((expense) => ({
        ...expense,
        date: Timestamp.fromDate(new Date(expense.date)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })),
    };
  }

  // Convert Firestore budget to local format
  private budgetFromFirestore(firestoreBudget: FirestoreBudget): MonthlyBudget {
    return {
      ...firestoreBudget,
      createdAt: firestoreBudget.createdAt.toDate().toISOString(),
      expenses: firestoreBudget.expenses.map((expense) => ({
        ...expense,
        date: expense.date.toDate().toISOString(),
      })),
    };
  }

  // Save budget to Firestore
  async saveBudget(budget: MonthlyBudget): Promise<void> {
    if (!this.familyId) {
      throw new Error(
        "No family ID set. Please create or join a family first."
      );
    }

    try {
      const familyRef = doc(db, "families", this.familyId);
      const familyDoc = await getDoc(familyRef);

      if (familyDoc.exists()) {
        const data = familyDoc.data() as FamilyData;
        const budgets = data.budgets || [];

        // Update existing budget or add new one
        const budgetIndex = budgets.findIndex((b) => b.id === budget.id);
        const firestoreBudget = this.budgetToFirestore(budget);

        if (budgetIndex >= 0) {
          budgets[budgetIndex] = firestoreBudget;
        } else {
          budgets.push(firestoreBudget);
        }

        await setDoc(familyRef, {
          ...data,
          budgets,
          lastUpdated: Timestamp.now(),
          lastUpdatedBy: this.memberId,
        });

        // Update member activity
        await this.updateMemberInfo();
      }
    } catch (error) {
      console.error("Error saving budget:", error);
      throw error;
    }
  }

  // Get all budgets
  async getBudgets(): Promise<MonthlyBudget[]> {
    if (!this.familyId) return [];

    try {
      const familyDoc = await getDoc(doc(db, "families", this.familyId));
      if (familyDoc.exists()) {
        const data = familyDoc.data() as FamilyData;
        return (data.budgets || []).map((budget) =>
          this.budgetFromFirestore(budget)
        );
      }
      return [];
    } catch (error) {
      console.error("Error getting budgets:", error);
      return [];
    }
  }

  // Subscribe to real-time family updates
  subscribeToFamilyUpdates(
    callback: (budgets: MonthlyBudget[], updatedBy: string) => void
  ): void {
    if (!this.familyId || this.isSubscribed) {
      console.log("Already subscribed or no family ID");
      return;
    }

    this.isSubscribed = true;
    console.log("🔔 Setting up real-time listener for family:", this.familyId);

    const unsubscribe = onSnapshot(
      doc(db, "families", this.familyId),
      (snapshot) => {
        if (snapshot.exists()) {
          const familyData = snapshot.data() as FamilyData;
          const budgets = familyData.budgets.map(this.budgetFromFirestore);
          console.log(
            "📡 Real-time update received:",
            budgets.length,
            "budgets"
          );
          callback(budgets, familyData.lastUpdatedBy);
        }
      },
      (error) => {
        console.error("Real-time listener error:", error);
        this.isSubscribed = false;
      }
    );

    this.unsubscribeFunctions.push(unsubscribe);
  }

  // Get family members
  async getFamilyMembers(): Promise<FamilyMember[]> {
    if (!this.familyId) return [];

    try {
      const familyDoc = await getDoc(doc(db, "families", this.familyId));
      if (familyDoc.exists()) {
        const data = familyDoc.data() as FamilyData;
        return data.members || [];
      }
      return [];
    } catch (error) {
      console.error("Error getting family members:", error);
      return [];
    }
  }

  // Set family name
  async setFamilyName(name: string): Promise<void> {
    if (!this.familyId) return;

    try {
      const familyRef = doc(db, "families", this.familyId);
      const familyDoc = await getDoc(familyRef);

      if (familyDoc.exists()) {
        const data = familyDoc.data() as FamilyData;
        await setDoc(familyRef, {
          ...data,
          familyName: name,
          lastUpdated: Timestamp.now(),
          lastUpdatedBy: this.memberId,
        });
      }
    } catch (error) {
      console.error("Error setting family name:", error);
      throw error;
    }
  }

  // Delete a budget
  async deleteBudget(budgetId: string): Promise<void> {
    if (!this.familyId) return;

    try {
      const familyRef = doc(db, "families", this.familyId);
      const familyDoc = await getDoc(familyRef);

      if (familyDoc.exists()) {
        const data = familyDoc.data() as FamilyData;
        const budgets = (data.budgets || []).filter((b) => b.id !== budgetId);

        await setDoc(familyRef, {
          ...data,
          budgets,
          lastUpdated: Timestamp.now(),
          lastUpdatedBy: this.memberId,
        });
      }
    } catch (error) {
      console.error("Error deleting budget:", error);
      throw error;
    }
  }

  // Cleanup all subscriptions
  cleanup(): void {
    this.unsubscribeFunctions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("Error unsubscribing:", error);
      }
    });
    this.unsubscribeFunctions = [];
    this.isSubscribed = false;
  }

  // Get current member info
  getCurrentMember(): FamilyMember {
    return {
      id: this.memberId,
      name: this.memberName,
      deviceInfo:
        typeof window !== "undefined" ? navigator.userAgent : "Server",
      lastSeen: Timestamp.now(),
      isOnline: true,
    };
  }

  // Initialize service (try to reconnect to existing family)
  async initialize(): Promise<void> {
    if (typeof window === "undefined") return; // Skip during SSR

    const storedFamilyId = localStorage.getItem("expense_tracker_family_id");
    console.log("🔍 Checking for stored family ID:", storedFamilyId);

    if (storedFamilyId) {
      try {
        // Verify the family still exists
        const familyDoc = await getDoc(doc(db, "families", storedFamilyId));
        if (familyDoc.exists()) {
          this.familyId = storedFamilyId;
          await this.updateMemberInfo(); // Update member presence
          console.log("✅ Reconnected to family:", storedFamilyId);
        } else {
          console.warn("❌ Stored family no longer exists, cleaning up");
          localStorage.removeItem("expense_tracker_family_id");
          this.familyId = null;
        }
      } catch (error) {
        console.warn("Failed to reconnect to stored family:", error);
        localStorage.removeItem("expense_tracker_family_id");
        this.familyId = null;
      }
    } else {
      console.log("📱 No stored family ID found");
    }
  }

  // Get member ID
  getMemberId(): string {
    return this.memberId;
  }
}

export const firestoreService = new FirestoreService();
