import React, { createContext, useState, useContext } from 'react';
import { INITIAL_REPORTS } from '../constants/mockData';

const ReportsContext = createContext();

export function ReportsProvider({ children }) {
  const [reports, setReports] = useState(INITIAL_REPORTS);

  const addReport = (reportData) => {
    const newReport = {
      id: `REP-${new Date().getFullYear()}-${String(reports.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'Pending Review',
      supervisorRemarks: null,
      ...reportData,
    };

    setReports((prev) => [newReport, ...prev]);
    return newReport;
  };

  const updateReportStatus = (id, newStatus, supervisorRemarks = '') => {
    setReports((prev) =>
      prev.map((rep) =>
        rep.id === id
          ? {
              ...rep,
              status: newStatus,
              supervisorRemarks: supervisorRemarks || rep.supervisorRemarks,
            }
          : rep
      )
    );
  };

  const stats = {
    total: reports.length,
    compliant: reports.filter((r) => r.isCompliant).length,
    violations: reports.filter((r) => !r.isCompliant).length,
    pending: reports.filter((r) => r.status === 'Pending Review').length,
    resolved: reports.filter((r) => r.status === 'Approved' || r.status === 'Notice Issued').length,
  };

  return (
    <ReportsContext.Provider
      value={{
        reports,
        stats,
        addReport,
        updateReportStatus,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  const context = useContext(ReportsContext);
  if (!context) {
    throw new Error('useReports must be used within a ReportsProvider');
  }
  return context;
}
