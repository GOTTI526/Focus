import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StickyNote, CheckCircle, Trash2, FileText, Upload, Bell, X } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function PanelEmpleado({ usuario, correo, usuarioId, onLogout }) {
  const [tareas, setTareas] = useState(() => {
    const datos = localStorage.getItem('tareas');
    return datos ? JSON.parse(datos) : [];
  });
  const [notas, setNotas] = useState(() => localStorage.getItem('notas') || '');
  const [dbTotal, setDbTotal] = useState(0);
  const [estaCargando, setEstaCargando] = useState(false);
  const [cargandoAsistencia, setCargandoAsistencia] = useState(true);
  const [nombreTramite, setNombreTramite] = useState('');
  const [descripcionTarea, setDescripcionTarea] = useState('');
  const [prioridadSel, setPrioridadSel] = useState('Media');
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [reloj, setReloj] = useState(new Date());
  const [asistenciaHoy, setAsistenciaHoy] = useState(null);
  const [tramitesDB, setTramitesDB] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotis, setMostrarNotis] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const manejarClickFuera = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMostrarNotis(false);
      }
    };
    document.addEventListener('mousedown', manejarClickFuera);
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, []);

  const cargarNotificaciones = useCallback(async () => {
    if (!usuarioId) return;
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });
    if (data) setNotificaciones(data);
  }, [usuarioId]);

  useEffect(() => {
    if (!usuarioId) return;
    cargarNotificaciones();
    const canal = supabase
      .channel(`notificaciones_empleado_${usuarioId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${usuarioId}`,
      }, (payload) => {
        setNotificaciones(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${usuarioId}`,
      }, (payload) => {
        setNotificaciones(prev =>
          prev.map(n => n.id === payload.new.id ? payload.new : n)
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [usuarioId, cargarNotificaciones]);

  const marcarLeida = async (id) => {
    await supabase.from('notificaciones').update({ leido: true }).eq('id', id);
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
  };

  const marcarTodasLeidas = async () => {
    const sinLeer = notificaciones.filter(n => !n.leido);
    if (sinLeer.length === 0) return;
    await Promise.all(sinLeer.map(n =>
      supabase.from('notificaciones').update({ leido: true }).eq('id', n.id)
    ));
    setNotificaciones(prev => prev.map(n => ({ ...n, leido: true })));
  };

  const eliminarNotificacion = async (id) => {
    await supabase.from('notificaciones').delete().eq('id', id);
    setNotificaciones(prev => prev.filter(n => n.id !== id));
  };

  const abrirDropdown = () => {
    setMostrarNotis(prev => !prev);
  };

  const cargarAsistencia = useCallback(async () => {
    if (!usuarioId) return;
    const hoy = new Date();
    const fechaLocal = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    const { data } = await supabase
      .from('asistencia')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('fecha', fechaLocal)
      .maybeSingle();
    if (data) setAsistenciaHoy(data);
    setCargandoAsistencia(false);
  }, [usuarioId]);

  const cargarTramitesDB = useCallback(async () => {
    if (!usuarioId) return;
    const { data } = await supabase
      .from('Tareas')
      .select('id, nombre_tramite, estado, observacion, created_at')
      .eq('operador_id', usuarioId)
      .order('created_at', { ascending: false });
    if (data) setTramitesDB(data);
  }, [usuarioId]);

  const cargarEstadisticas = useCallback(async () => {
    if (!usuarioId) return;
    const { count } = await supabase
      .from('Tareas')
      .select('*', { count: 'exact', head: true })
      .eq('operador_id', usuarioId);
    if (count !== null) setDbTotal(count);
  }, [usuarioId]);

  useEffect(() => {
    cargarAsistencia();
    cargarTramitesDB();
    cargarEstadisticas();
  }, [cargarAsistencia, cargarTramitesDB, cargarEstadisticas]);

  useEffect(() => {
    localStorage.setItem('tareas', JSON.stringify(tareas));
    localStorage.setItem('notas', notas);
  }, [tareas, notas]);

  const registrarEntrada = async () => {
    if (!usuarioId || asistenciaHoy) return;
    const horaActual = new Date().toLocaleTimeString('it-IT');
    const hoy = new Date();
    const fechaLocal = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    const { error } = await supabase.from('asistencia').insert([{
      usuario_id: usuarioId,
      usuario_email: correo,
      hora_entrada: horaActual,
      fecha: fechaLocal
    }]);
    if (!error) await cargarAsistencia();
  };

  const registrarSalida = async () => {
    if (!asistenciaHoy?.id || asistenciaHoy.hora_salida) return;
    const horaActual = new Date().toLocaleTimeString('it-IT');
    const { error } = await supabase.from('asistencia').update({ hora_salida: horaActual }).eq('id', asistenciaHoy.id);
    if (!error) await cargarAsistencia();
  };

  const sincronizarConDB = async () => {
    const listas = tareas.filter(t => t.estado === 'listo');
    if (listas.length === 0) return alert('No hay tareas listas');
    setEstaCargando(true);
    try {
      for (const t of listas) {
        let urlPublica = 'SIN ARCHIVO';
        if (t.fileBlob) {
          const fileName = `${Date.now()}_${t.nombreArchivo.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          await supabase.storage.from('documentos_tramites').upload(fileName, t.fileBlob);
          const { data: urlData } = supabase.storage.from('documentos_tramites').getPublicUrl(fileName);
          urlPublica = urlData.publicUrl;
        }
        await supabase.from('Tareas').insert([{
          nombre_tramite: t.titulo,
          descripcion: t.resumen,
          prioridad: t.prioridad,
          url_word: urlPublica,
          operador_id: usuarioId,
          operador: correo,
          estado: 'PENDIENTE',
        }]);
      }
      setTareas(tareas.filter(t => t.estado !== 'listo'));
      alert('Sincronizacion exitosa');
      cargarEstadisticas();
      cargarTramitesDB();
    } catch (err) {
      alert(err.message);
    } finally {
      setEstaCargando(false);
    }
  };

  const agregarTarea = () => {
    if (!nombreTramite.trim() || !descripcionTarea.trim()) return alert('Faltan campos');
    const nueva = {
      id: Date.now(),
      titulo: nombreTramite.toUpperCase(),
      resumen: descripcionTarea,
      prioridad: prioridadSel,
      estado: 'pendiente',
      nombreArchivo: archivoSeleccionado ? archivoSeleccionado.name : null,
      fileBlob: archivoSeleccionado,
    };
    setTareas([nueva, ...tareas]);
    setNombreTramite('');
    setDescripcionTarea('');
    setArchivoSeleccionado(null);
  };

  const colorEstadoDB = (estado) => {
    if (estado === 'APROBADO') return 'bg-green-100 text-green-700';
    if (estado === 'OBSERVADO') return 'bg-yellow-100 text-yellow-700';
    if (estado === 'RECHAZADO') return 'bg-red-100 text-red-600';
    return 'bg-orange-100 text-orange-600';
  };

  const noLeidas = notificaciones.filter(n => !n.leido).length;
  const tareasListas = tareas.filter(t => t.estado === 'listo').length;

  return (
    <div className="min-h-screen bg-[#f0fffb] p-6 text-slate-900 font-sans tracking-tighter">
      <header className="bg-[#1a4b4c] p-6 rounded-[2rem] shadow-lg mb-6 flex justify-between items-center text-white">
        <div>
          <h1 className="text-3xl font-black uppercase">FocusOS</h1>
          <span className="text-[10px] font-black text-teal-300 uppercase block">Operador: {usuario}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={abrirDropdown}
              className="bg-white/10 text-white p-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all relative"
            >
              <Bell size={16} />
              {noLeidas > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {noLeidas}
                </span>
              )}
            </button>

            {mostrarNotis && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-[1.5rem] shadow-2xl border border-teal-50 z-50 overflow-hidden">
                <div className="p-4 border-b border-teal-50 flex justify-between items-center">
                  <span className="font-black text-xs text-[#1a4b4c] uppercase tracking-widest">Notificaciones</span>
                  <div className="flex items-center gap-2">
                    {noLeidas > 0 && (
                      <button
                        onClick={marcarTodasLeidas}
                        className="text-[9px] font-black text-teal-500 uppercase hover:text-teal-700 transition-colors"
                      >
                        Marcar todas
                      </button>
                    )}
                    <span className="text-[10px] font-black text-slate-400 uppercase">{notificaciones.length} total</span>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {notificaciones.length === 0 && (
                    <p className="text-center py-8 font-black text-slate-200 uppercase text-xs tracking-widest">Sin notificaciones</p>
                  )}
                  {notificaciones.map(n => (
                    <div key={n.id} className={`p-4 flex items-start gap-3 transition-all ${n.leido ? 'opacity-50' : 'bg-teal-50/30'}`}>
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        n.tipo_notificacion === 'RECHAZADO' ? 'bg-red-400'
                        : n.tipo_notificacion === 'OBSERVADO' ? 'bg-yellow-400'
                        : 'bg-green-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${colorEstadoDB(n.tipo_notificacion)}`}>
                          {n.tipo_notificacion}
                        </span>
                        <p className="font-bold text-xs text-slate-600 mt-1 line-clamp-2">{n.mensaje}</p>
                        {n.creado_en && (
                          <p className="text-[9px] font-bold text-slate-300 mt-0.5">
                            {new Date(n.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                        {!n.leido && (
                          <button
                            onClick={() => marcarLeida(n.id)}
                            className="text-[9px] font-black text-teal-500 uppercase hover:text-teal-700 transition-colors whitespace-nowrap"
                          >
                            Leido
                          </button>
                        )}
                        <button onClick={() => eliminarNotificacion(n.id)} className="text-slate-200 hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={onLogout} className="bg-red-500/20 text-red-300 font-black text-[10px] px-4 py-2 rounded-xl border border-red-400/30 uppercase">Cerrar Sesion</button>
        </div>
      </header>

      {noLeidas > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Bell size={12} /> Nuevas Notificaciones
          </h2>
          {notificaciones.filter(n => !n.leido).map(n => (
            <div key={n.id} className={`p-5 rounded-[2rem] flex items-start gap-4 ${
              n.tipo_notificacion === 'RECHAZADO' ? 'bg-red-50 border-l-4 border-red-400'
              : n.tipo_notificacion === 'OBSERVADO' ? 'bg-yellow-50 border-l-4 border-yellow-400'
              : 'bg-green-50 border-l-4 border-green-400'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorEstadoDB(n.tipo_notificacion)}`}>
                    {n.tipo_notificacion}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#1a4b4c] text-white font-black text-[9px] uppercase">Nuevo</span>
                </div>
                <p className={`font-bold text-sm mt-1 ${
                  n.tipo_notificacion === 'RECHAZADO' ? 'text-red-600'
                  : n.tipo_notificacion === 'OBSERVADO' ? 'text-yellow-700'
                  : 'text-green-700'
                }`}>{n.mensaje}</p>
                {n.creado_en && (
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    {new Date(n.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <button onClick={() => marcarLeida(n.id)} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors whitespace-nowrap">
                Marcar leido
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-[2rem] text-center shadow-sm border border-teal-50">
              <p className="text-[10px] font-black text-slate-400 uppercase">Sincronizados</p>
              <p className="text-4xl font-black text-[#1a4b4c]">{dbTotal}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] text-center shadow-sm border border-teal-50">
              <p className="text-[10px] font-black text-slate-400 uppercase">Pendientes</p>
              <p className="text-4xl font-black text-orange-400">{tareas.filter(t => t.estado === 'pendiente').length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] text-center shadow-sm border border-teal-50">
              <p className="text-[10px] font-black text-slate-400 uppercase">Listos</p>
              <p className="text-4xl font-black text-green-500">{tareasListas}</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-teal-50">
            <h2 className="text-sm font-black text-slate-400 mb-6 uppercase">Nuevo Registro</h2>
            <div className="space-y-4">
              <input type="text" placeholder="NOMBRE DEL TRAMITE..." className="w-full p-5 bg-[#f8fafc] rounded-2xl outline-none font-bold uppercase" value={nombreTramite} onChange={(e) => setNombreTramite(e.target.value)} />
              <textarea placeholder="RESUMEN..." className="w-full p-5 bg-[#f8fafc] rounded-2xl outline-none font-bold h-24 resize-none uppercase" value={descripcionTarea} onChange={(e) => setDescripcionTarea(e.target.value)} />
              <div className="flex items-center gap-4 p-4 bg-[#f8fafc] rounded-2xl border-2 border-dashed border-teal-100">
                <label className="flex items-center gap-2 cursor-pointer bg-[#1a4b4c] text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase">
                  <Upload size={14} /> Adjuntar Archivo
                  <input type="file" className="hidden" accept=".doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx" onChange={(e) => setArchivoSeleccionado(e.target.files[0])} />
                </label>
                <span className="text-[10px] font-bold text-slate-400 truncate">
                  {archivoSeleccionado ? archivoSeleccionado.name : 'Word, PDF, Excel...'}
                </span>
              </div>
              <div className="flex gap-2">
                {['Alta', 'Media', 'Baja'].map(p => (
                  <button key={p} onClick={() => setPrioridadSel(p)}
                    className={`flex-1 py-4 rounded-xl font-black text-xs uppercase ${
                      prioridadSel === p
                        ? p === 'Alta' ? 'bg-red-500 text-white' : p === 'Media' ? 'bg-yellow-400 text-white' : 'bg-green-500 text-white'
                        : 'bg-slate-50 text-slate-300'
                    }`}>{p}
                  </button>
                ))}
              </div>
              <button onClick={agregarTarea} className="w-full bg-[#38b2ac] text-white py-5 rounded-2xl font-black text-xl uppercase shadow-lg">Guardar en Cola</button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-teal-50 min-h-[300px]">
            <h2 className="text-sm font-black text-slate-400 mb-6 uppercase text-center">Cola de Procesamiento</h2>
            <div className="space-y-3">
              {tareas.sort((a, b) => b.id - a.id).map(t => (
                <div key={t.id} className={`flex items-center justify-between p-5 rounded-2xl border ${t.estado === 'listo' ? 'bg-slate-50 opacity-40' : 'bg-white shadow-sm'}`}>
                  <div className="flex flex-col text-left">
                    <span className="font-black text-sm uppercase">{t.titulo}</span>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-2">
                      {t.resumen} {t.nombreArchivo && <span className="text-teal-600 flex items-center gap-1 uppercase text-[8px]">[ <FileText size={10} /> {t.nombreArchivo} ]</span>}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {t.estado === 'pendiente' && (
                      <button onClick={() => setTareas(tareas.map(x => x.id === t.id ? { ...x, estado: 'listo' } : x))} className="p-3 bg-green-50 text-green-600 rounded-xl">
                        <CheckCircle size={18} />
                      </button>
                    )}
                    <button onClick={() => setTareas(tareas.filter(x => x.id !== t.id))} className="p-3 bg-red-50 text-red-400 rounded-xl">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {tareas.length === 0 && <p className="text-center py-10 font-black text-slate-200 uppercase tracking-widest">Cola vacia</p>}
            </div>

            <button
              onClick={sincronizarConDB}
              disabled={estaCargando || tareasListas === 0}
              className={`mt-6 w-full py-4 rounded-2xl font-black text-sm uppercase transition-all ${
                tareasListas > 0 && !estaCargando
                  ? 'bg-[#1a4b4c] text-white shadow-lg hover:bg-teal-800'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {estaCargando ? 'Sincronizando...' : `Sincronizar Tramites Listos${tareasListas > 0 ? ` (${tareasListas})` : ''}`}
            </button>
          </div>

          {tramitesDB.length > 0 && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-teal-50">
              <h2 className="text-sm font-black text-slate-400 mb-6 uppercase text-center">Mis Tramites Enviados</h2>
              <div className="space-y-3">
                {tramitesDB.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#f8fafc]">
                    <div className="flex flex-col gap-1">
                      <p className="font-black text-sm text-slate-700 uppercase">{t.nombre_tramite}</p>
                      {t.observacion && (
                        <p className={`text-[10px] font-bold ${t.estado === 'RECHAZADO' ? 'text-red-500' : 'text-yellow-600'}`}>
                          Motivo: {t.observacion}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorEstadoDB(t.estado)}`}>
                      {t.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-teal-50">
            <h2 className="text-sm font-black text-slate-400 mb-4 uppercase text-center">Asistencia</h2>
            <div className="text-center mb-6 bg-[#f8fafc] p-4 rounded-2xl border border-teal-50">
              <div className="text-4xl font-black text-[#1a4b4c] font-mono">
                {reloj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={registrarEntrada} disabled={cargandoAsistencia || asistenciaHoy !== null}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase border-2 ${
                  asistenciaHoy || cargandoAsistencia ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-white border-[#38b2ac] text-[#38b2ac]'
                }`}>
                {asistenciaHoy?.hora_entrada ? `Entrada: ${asistenciaHoy.hora_entrada}` : 'Registrar Entrada'}
              </button>
              <button onClick={registrarSalida} disabled={cargandoAsistencia || !asistenciaHoy || asistenciaHoy?.hora_salida !== null}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase border-2 ${
                  !asistenciaHoy || asistenciaHoy?.hora_salida || cargandoAsistencia ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-white border-red-500 text-red-500'
                }`}>
                {asistenciaHoy?.hora_salida ? `Salida: ${asistenciaHoy.hora_salida}` : 'Registrar Salida'}
              </button>
            </div>
          </div>

          <div className="bg-[#1a4b4c] p-8 rounded-[2.5rem] shadow-xl text-white min-h-[400px] flex flex-col">
            <h2 className="text-sm font-black mb-6 uppercase tracking-widest flex items-center gap-2">
              <StickyNote size={18} /> Bloc de Notas
            </h2>
            <textarea
              className="flex-1 bg-black/10 rounded-2xl p-5 outline-none font-bold text-sm resize-none uppercase placeholder:text-white/20"
              placeholder="Notas temporales..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
            <p className="mt-3 text-center text-[10px] font-black text-teal-300/60 uppercase tracking-widest">
              Guardado automatico local
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
