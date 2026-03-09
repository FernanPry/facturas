export default function SmartCard({ title, value, subtext, icon, color }) {
    return (
        <div className="card" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                fontSize: '4rem',
                opacity: 0.05,
                transform: 'rotate(15deg)'
            }}>
                {icon}
            </div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {title}
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: color || 'var(--text-main)' }}>
                {value}
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {subtext}
            </p>
        </div>
    );
}
