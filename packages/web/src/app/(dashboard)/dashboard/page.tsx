export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-sand-800">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-sand-500">
          Welcome to Grip Shot. Your Amazon product image command center.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Products" value="—" description="Products onboarded" />
        <StatCard
          title="Images generated"
          value="—"
          description="Total images created"
        />
        <StatCard
          title="Credits remaining"
          value="—"
          description="Monthly quota"
        />
      </div>

      <div className="rounded-xl border border-sand-200 bg-white p-6">
        <h2 className="text-lg font-medium text-sand-800">Getting started</h2>
        <p className="mt-2 text-sm text-sand-500 leading-relaxed">
          Start by onboarding your brand and uploading product references.
          Once your products are set up, you can generate Amazon-ready listing
          images, lifestyle shots, and A+ content directly from the dashboard.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-sand-200 bg-white p-5">
      <p className="text-xs font-medium text-sand-400 uppercase tracking-wider">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold text-sand-800">{value}</p>
      <p className="mt-1 text-xs text-sand-400">{description}</p>
    </div>
  );
}
