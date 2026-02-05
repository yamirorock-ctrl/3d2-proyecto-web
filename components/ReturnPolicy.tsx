
import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const ReturnPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Política de Devolución</h1>
                    
                    <div className="prose prose-indigo max-w-none text-gray-600 space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Consideraciones Generales</h2>
                            <p>
                                En 3D2 nos esforzamos por garantizar la calidad de cada pieza que fabricamos. 
                                Entendemos que pueden surgir inconvenientes, y por ello establecemos la siguiente política, 
                                alineada con la legislación vigente en la República Argentina.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Productos Personalizados</h2>
                            <p className="font-medium text-gray-900 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                ⚠️ Importante: Los productos fabricados bajo pedido, personalizados con nombres, fechas, logos 
                                o especificaciones particulares del cliente, <strong>NO tienen cambio ni devolución</strong>, salvo por defectos de fabricación.
                            </p>
                            <p className="text-sm mt-2">
                                (Conforme al Artículo 1116 del Código Civil y Comercial de la Nación sobre excepciones al derecho de revocación).
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Productos de Stock / Catálogo</h2>
                            <p>
                                Para productos estandarizados (no personalizados) comprados directamente en nuestra web:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>Dispone de <strong>10 días corridos</strong> desde la recepción del producto para solicitar el cambio o devolución.</li>
                                <li>El producto debe estar sin uso, en perfectas condiciones y en su embalaje original.</li>
                                <li>El costo de envío por cambio de modelo/color corre por cuenta del comprador.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Productos con Fallas o Roturas</h2>
                            <p>
                                Si el producto llegó roto o con un defecto de fabricación:
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>Debe notificarlo dentro de las <strong>48 horas</strong> de recibido.</li>
                                <li>Envíenos fotos del producto y del embalaje a nuestro WhatsApp o Email.</li>
                                <li>En este caso, <strong>nosotros cubriremos los costos de reposición y envío</strong>.</li>
                            </ul>
                        </section>

                        <section className="pt-6 border-t border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-2">Contacto para gestiones</h2>
                            <p>
                                Para iniciar un reclamo o consulta, escríbanos a:<br/>
                                <span className="font-medium text-indigo-600">consultas@creart3d2.com</span> o a nuestro WhatsApp oficial.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReturnPolicy;
