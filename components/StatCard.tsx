import { Icon, type IconName } from './Icon';

type Tone = 'green' | 'red' | 'blue' | 'tan';

interface StatCardProps {
  label: string;
  value: string;
  icon?: IconName;
  hint?: string;
  tone?: Tone; // icon chip color — defaults to 'tan', matching every existing call site's look
  trend?: number; // signed % vs. a prior period — renders as a green/red pill, omit if no baseline
}

export function StatCard({ label, value, icon, hint, tone = 'tan', trend }: StatCardProps) {
  return (
    <div className="card" style={{ padding: 20, position: 'relative' }}>
      {icon && (
        <div
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `var(--color-${tone}-bg)`,
            color: `var(--color-${tone}-text)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={17} />
        </div>
      )}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, marginTop: 8, paddingRight: icon ? 44 : 0 }}>{value}</div>
      {trend !== undefined && (
        <span className={`pill ${trend >= 0 ? 'pill-green' : 'pill-red'}`} style={{ marginTop: 6 }}>
          {trend >= 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}%
        </span>
      )}
      {hint && <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
