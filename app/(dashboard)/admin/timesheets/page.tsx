"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import SmartLoader from "@/components/ui/SmartLoader";
import Combobox from "@/components/ui/Combobox";
import { motion } from "framer-motion";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function AdminTimesheets() {
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState("");

  const searchParams = useSearchParams();

 

  const loadUsers = async () => {
    const res = await apiFetch("/users");
    setUsers(Array.isArray(res) ? res : res.data);
  };

  const loadTimesheets = async (userId?: string) => {
    try {
      let url = "/timesheets";

      if (userId) {
        url += `?filter=userId||$eq||${userId}`;
      }

      const res = await apiFetch(url);
      const data = Array.isArray(res) ? res : res.data;

      setTimesheets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userId = searchParams.get("userId") || "";

    setSelectedUser(userId);

    loadUsers();
    loadTimesheets(userId);
  }, []);

  const handleUserChange = (id: string) => {
    setSelectedUser(id);
    setLoading(true);
    loadTimesheets(id);
  };

 

  const totalHours = timesheets.reduce(
    (sum, t) => sum + (t.hours || 0),
    0
  );


  const projectMap: Record<string, number> = {};
  const dateMap: Record<string, number> = {};

  timesheets.forEach((t) => {
    const project = t.project?.name || "Unknown";
    const date = t.date;

    projectMap[project] =
      (projectMap[project] || 0) + (t.hours || 0);

    dateMap[date] = (dateMap[date] || 0) + (t.hours || 0);
  });

  const projectData = Object.keys(projectMap).map((key) => ({
    name: key,
    hours: projectMap[key],
  }));

  const dateData = Object.keys(dateMap).map((key) => ({
    date: key,
    hours: dateMap[key],
  }));

  const COLORS = ["#111827", "#4B5563", "#9CA3AF", "#D1D5DB"];

  const getUser = () => {
    try {
      const token = localStorage.getItem("token");
      return JSON.parse(atob(token!.split(".")[1]));
    } catch {
      return { name: "Admin" };
    }
  };

  if (loading) {
    return <SmartLoader name={getUser().name} />;
  }

 

  return (
    <div className="space-y-6">

  
      <div>
        <h1 className="text-2xl font-semibold">
          Timesheet Analytics
        </h1>
        <p className="text-sm text-slate-500">
          Visual insights of productivity
        </p>
      </div>

     
      <div className="flex gap-3 items-center">
        <span className="text-sm text-slate-600">Select User:</span>
        <Combobox
          value={selectedUser}
          onChange={handleUserChange}
          placeholder="All Users"
          searchable
          className="w-64"
          options={[
            { value: "", label: "All Users" },
            ...users.map((u: any) => ({ value: String(u.id), label: u.name })),
          ]}
        />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Entries" value={timesheets.length} />
        <Card title="Total Hours" value={`${totalHours}h`} />
        <Card
          title="Avg Hours"
          value={`${(
            totalHours / (timesheets.length || 1)
          ).toFixed(1)}h`}
        />
      </div>

    
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* BAR */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded shadow"
        >
          <h3 className="mb-3 text-sm font-medium">
            Hours per Project
          </h3>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={projectData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* LINE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded shadow"
        >
          <h3 className="mb-3 text-sm font-medium">
            Daily Trend
          </h3>

          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dateData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="hours" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

   
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-4 rounded shadow"
      >
        <h3 className="mb-3 text-sm font-medium">
          Project Distribution
        </h3>

        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={projectData}
              dataKey="hours"
              nameKey="name"
              outerRadius={80}
            >
              {projectData.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

    </div>
  );
}


function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}