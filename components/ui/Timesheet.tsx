"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Row = {
  project: string;
  hours: number[];
};

export default function Timesheet() {
  const [rows, setRows] = useState<Row[]>([
    {
      project: "Project A",
      hours: [0, 0, 0, 0, 0],
    },
  ]);

  const updateHours = (rowIndex: number, dayIndex: number, value: number) => {
    // 🛡️ prevent negative values
    const safeValue = Math.max(0, value);

    const newRows = [...rows];
    newRows[rowIndex].hours[dayIndex] = safeValue;
    setRows(newRows);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { project: "New Project", hours: [0, 0, 0, 0, 0] },
    ]);
  };

  const totalRow = (hours: number[]) =>
    hours.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">

      <h2 className="text-lg font-medium text-slate-800 mb-4">
        Timesheet
      </h2>

      {/* 📱 Mobile scroll wrapper */}
      <div className="overflow-x-auto">

        <table className="min-w-[600px] w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left">Project</th>
              <th>Mon</th>
              <th>Tue</th>
              <th>Wed</th>
              <th>Thu</th>
              <th>Fri</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            <AnimatePresence>
              {rows.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t"
                >

                  {/* Project */}
                  <td className="py-2 text-slate-700 font-medium">
                    {row.project}
                  </td>

                  {/* Inputs */}
                  {row.hours.map((h, j) => (
                    <td key={j} className="text-center">
                      <motion.input
                        whileFocus={{ scale: 1.05 }}
                        type="number"
                        min={0}
                        value={h}
                        className="w-14 px-2 py-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        onChange={(e) =>
                          updateHours(i, j, Number(e.target.value))
                        }
                      />
                    </td>
                  ))}

                  {/* Total */}
                  <td className="text-center font-medium text-slate-800">
                    {totalRow(row.hours)}
                  </td>

                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Add Button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.03 }}
        onClick={addRow}
        className="mt-4 text-sm bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition"
      >
        + Add Project
      </motion.button>
    </div>
  );
}