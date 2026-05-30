import { useState } from 'react';

export default function SmartCard({ title, value, subtext, icon, color, details = [], info }) {
    const hasDetails = Array.isArray(details) && details.length > 0;
    const hasExpandableContent = hasDetails || Boolean(info || subtext);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className={`card smart-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}`} style={{ '--accent-color': color || 'var(--text-main)' }}>
            <div className="smart-card-watermark" aria-hidden="true">{icon}</div>

            <div className="smart-card-header">
                <div>
                    <h3 className="smart-card-title">{title}</h3>
                    <div className="smart-card-value" style={{ color: color || 'var(--text-main)' }}>
                        {value}
                    </div>
                </div>
                <div className="smart-card-actions">
                    <div className="smart-card-icon" aria-hidden="true">{icon}</div>
                    {hasExpandableContent && (
                        <button
                            type="button"
                            className="smart-card-toggle"
                            onClick={() => setIsExpanded((current) => !current)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? `Contraer ${title}` : `Expandir ${title}`}
                            title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                        >
                            {isExpanded ? '−' : '+'}
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <>
                    {info && <p className="smart-card-info">{info}</p>}

                    {hasDetails ? (
                        <div className="smart-card-children">
                            {details.map((item) => (
                                <div className="smart-card-child" key={item.label}>
                                    <div className="smart-card-child-label">{item.label}</div>
                                    <div className="smart-card-child-value">{item.value}</div>
                                    {item.description && (
                                        <div className="smart-card-child-description">{item.description}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : subtext ? (
                        <p className="smart-card-subtext">{subtext}</p>
                    ) : null}
                </>
            )}
        </div>
    );
}
