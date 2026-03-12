import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

export default function ManualUpload({ apiBase }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setResult(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setResult(null);

        const formData = new FormData();
        formData.append('invoice', file);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiBase}/invoices/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error("Error uploading invoice:", error);
            setResult({ error: "Error de conexión al subir la factura." });
        } finally {
            setLoading(false);
            setFile(null);
            // Reset visible input
            document.getElementById('file-upload').value = "";
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto">
            <div className="card">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Subir Facturas</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Selecciona un archivo PDF o una imagen (JPG/PNG) para que nuestra IA procese los datos automáticamente.
                </p>

                <div 
                    style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '1rem',
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        background: 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                        position: 'relative'
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files[0]) {
                            setFile(e.dataTransfer.files[0]);
                            setResult(null);
                        }
                    }}
                    onClick={() => document.getElementById('file-upload').click()}
                >
                    <input 
                        id="file-upload"
                        type="file" 
                        onChange={handleFileChange}
                        accept="application/pdf,image/*"
                        style={{ display: 'none' }}
                    />
                    
                    <div className="flex flex-col items-center gap-3">
                        <div style={{ width: '64px', height: '64px', background: 'var(--bg-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', marginBottom: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <Upload size={32} className="text-indigo-600" />
                        </div>
                        {file ? (
                            <div>
                                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>{file.name}</p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Archivo seleccionado</p>
                            </div>
                        ) : (
                            <>
                                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Arrastra tu factura aquí o haz clic para buscar</p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>PDF, PNG o JPG (máx. 10MB)</p>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button 
                        className="btn btn-primary" 
                        onClick={handleUpload} 
                        disabled={!file || loading}
                        style={{ width: '100%', padding: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Procesando Factura...
                            </>
                        ) : (
                            <>
                                <FileText size={20} />
                                Subir Factura
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Resultado del procesamiento */}
            {result && (
                <div 
                    className="card animate-in fade-in slide-in-from-bottom-4"
                    style={{ 
                        borderLeft: `6px solid ${result.error ? 'var(--danger)' : result.warning ? 'var(--warning)' : 'var(--success)'}`,
                        background: result.error ? '#fef2f2' : result.warning ? '#fffbeb' : '#f0fdf4'
                    }}
                >
                    <div className="flex gap-4">
                        <div style={{ marginTop: '0.25rem' }}>
                            {result.error ? (
                                <XCircle className="text-red-600" size={24} />
                            ) : result.warning ? (
                                <AlertTriangle className="text-amber-600" size={24} />
                            ) : (
                                <CheckCircle className="text-emerald-600" size={24} />
                            )}
                        </div>
                        <div>
                            <h4 style={{ 
                                fontWeight: 700, 
                                fontSize: '1.1rem',
                                color: result.error ? '#991b1b' : result.warning ? '#92400e' : '#166534',
                                marginBottom: '0.25rem'
                            }}>
                                {result.error ? "Error al procesar" : result.warning ? "Aviso en factura" : "Proceso correcto"}
                            </h4>
                            <p style={{ 
                                color: result.error ? '#dc2626' : result.warning ? '#b45309' : '#15803d',
                                fontSize: '0.95rem',
                                lineHeight: '1.5'
                            }}>
                                {result.error || result.message}
                            </p>
                            
                            {!result.error && result.invoice && (
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '0.5rem' }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>DETALLES EXTRAÍDOS:</p>
                                    <div className="grid grid-cols-2 gap-2 mt-2" style={{ fontSize: '0.85rem' }}>
                                        <span>📅 Fecha:</span> <span className="font-semibold">{result.invoice.invoice_date}</span>
                                        <span>👤 Emisor:</span> <span className="font-semibold">{result.invoice.emisor}</span>
                                        <span>🔢 Factura:</span> <span className="font-semibold">{result.invoice.reference}</span>
                                        <span>💵 Total:</span> <span className="font-semibold">{result.invoice.total}€</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
