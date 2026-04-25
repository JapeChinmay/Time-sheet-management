import Timesheet from "@/components/ui/Timesheet";

export default function TimesheetPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium text-slate-800 mb-4">
        Timesheet Entry
      </h1>

      <Timesheet />
    </div>
  );
}