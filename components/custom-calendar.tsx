"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./custom-calendar.css";

type CalendarStatus = 'full day' | 'half day' | 'absent' | 'paid' | 'activity';

interface AttendanceData {
  employeeId: number;
  attendanceStatus: CalendarStatus;
  checkinDate: string;
  checkoutDate: string | null;
}

interface CustomCalendarProps {
  month: number;
  year: number;
  attendanceData: AttendanceData[];
  onSummaryChange: (summary: { fullDays: number; halfDays: number; absentDays: number }) => void;
  onDateClick: (date: string, employeeName: string) => void;
  employeeName: string;
}

const formatStatusLabel = (status: string): string => {
  switch (status) {
    case 'full day': return 'Full Day';
    case 'present': return 'Absent'; // Present is treated as Absent per business requirements
    case 'half day': return 'Half Day';
    case 'absent': return 'Absent';
    case 'paid': return 'Paid Leave';
    case 'activity': return 'Activity';
    default:
      return status
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

const CustomCalendar: React.FC<CustomCalendarProps> = ({
  month,
  year,
  attendanceData,
  onSummaryChange,
  onDateClick,
  employeeName,
}) => {

  // Calculate all calendar logic using useMemo so it automatically syncs when props change
  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let fullDays = 0;
    let halfDays = 0;
    let absentDays = 0;

    const daysArray = [];

    // normalize helper
    const normalizeDate = (dateStr: string) => dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

    // 1. Add empty slots for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      daysArray.push({ type: 'empty', key: `empty-${i}` });
    }

    // 2. Generate actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dateObj = new Date(year, month, i);
      dateObj.setHours(0, 0, 0, 0);

      const isSunday = dateObj.getDay() === 0;
      const isFutureDate = dateObj > today;

      // Sundays are paid leave by policy, regardless of whether an attendance
      // record exists for that date.
      if (isSunday) {
        daysArray.push({
          type: 'day',
          key: dateKey,
          dayNumber: i,
          className: 'paid',
          tooltipText: formatStatusLabel('paid'),
          dateKey,
          isSunday,
        });
        continue;
      }

      // Find attendance
      const attendanceRecord = attendanceData.find((data) => {
        return normalizeDate(data.checkinDate) === dateKey;
      });

      const attendanceStatus = attendanceRecord?.attendanceStatus;

      let className = '';
      let tooltipText = '';

      // Logic: use attendance status for counting on all days (including Sunday).
      if (attendanceStatus) {
        const normalizedStatus = attendanceStatus.toLowerCase().trim();

        className = normalizedStatus.replace(/\s+/g, '-');
        tooltipText = formatStatusLabel(normalizedStatus);

        if (normalizedStatus === 'full day') fullDays++;
        else if (normalizedStatus === 'half day') halfDays++;
        else if (normalizedStatus === 'absent' || normalizedStatus === 'present') absentDays++;
      } else {
        if (isFutureDate) {
          className = 'future';
          tooltipText = 'Upcoming';
        } else {
          className = 'absent';
          tooltipText = formatStatusLabel('absent');
          absentDays++;
        }
      }


      daysArray.push({
        type: 'day',
        key: dateKey,
        dayNumber: i,
        className,
        tooltipText,
        dateKey,
        isSunday
      });
    }

    return { daysArray, summary: { fullDays, halfDays, absentDays } };
  }, [month, year, attendanceData]);

  // Sync summary to parent whenever the calculated summary changes
  useEffect(() => {
    onSummaryChange(calendarData.summary);
  }, [calendarData.summary, onSummaryChange]);

  return (
    <div className="custom-calendar">
      <div className="calendar-days">
        <div>S</div>
        <div>M</div>
        <div>T</div>
        <div>W</div>
        <div>T</div>
        <div>F</div>
        <div>S</div>
      </div>
      <div className="calendar-dates">
        {calendarData.daysArray.map((item) => {
          if (item.type === 'empty') {
            return <div key={item.key} className="empty" />;
          }
          return (
            <div
              key={item.key}
              className={item.className}
              onClick={() => onDateClick(item.dateKey!, employeeName)}
            >
              {item.dayNumber}
              {/* Tooltip inline to ensure it syncs with React state */}
              <span
                className="calendar-tooltip"
                style={item.isSunday ? {
                  '--tooltip-translate-x': '-20%',
                  '--tooltip-arrow-left': '35%'
                } as React.CSSProperties : undefined}
              >
                {item.tooltipText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomCalendar;
