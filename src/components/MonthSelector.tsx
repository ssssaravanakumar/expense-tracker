import React from "react";
import { Calendar } from "lucide-react";
import { format, parseISO, subMonths, addMonths } from "date-fns";
import { Select } from "@/components/ui";

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  availableMonths: string[];
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onMonthChange,
  availableMonths,
}) => {
  const formatDisplayMonth = (month: string) => {
    return format(parseISO(month + "-01"), "MMM yyyy");
  };

  // Generate month options (6 months back and 6 months forward from current date)
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();

    // Add 6 months back
    for (let i = 6; i >= 1; i--) {
      const month = format(subMonths(currentDate, i), "yyyy-MM");
      options.push({
        value: month,
        label:
          formatDisplayMonth(month) +
          (availableMonths.includes(month) ? " ●" : ""),
      });
    }

    // Add current month
    const currentMonth = format(currentDate, "yyyy-MM");
    options.push({
      value: currentMonth,
      label:
        formatDisplayMonth(currentMonth) +
        (availableMonths.includes(currentMonth) ? " ●" : ""),
    });

    // Add 6 months forward
    for (let i = 1; i <= 6; i++) {
      const month = format(addMonths(currentDate, i), "yyyy-MM");
      options.push({
        value: month,
        label:
          formatDisplayMonth(month) +
          (availableMonths.includes(month) ? " ●" : ""),
      });
    }

    return options;
  };

  const monthOptions = generateMonthOptions();

  return (
    <div className="flex items-center space-x-2">
      <Calendar className="h-4 w-4 text-gray-600" />
      <Select
        value={selectedMonth}
        onChange={onMonthChange}
        options={monthOptions}
        placeholder="Select month"
        className="min-w-[120px]"
      />
    </div>
  );
};
