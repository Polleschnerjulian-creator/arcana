import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Einstellungen
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Unternehmens-, Buchhaltungs- und Kontoeinstellungen verwalten
        </p>
      </div>
      <div className="flex gap-8">
        {/* Sub Navigation */}
        <SettingsNav />
        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
