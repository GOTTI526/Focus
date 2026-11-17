import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, Download, CheckCircle, XCircle, Eye, Trash2, ClipboardList, Users, Search, Bell, X, MessageSquare, FileDown, Send } from 'lucide-react';
import { supabase } from './supabaseClient';
import { exportToExcel } from './exportToExcel';

const ESTADOS_TRAMITE = ['PENDIENTE', 'APROBADO', 'OBSERVADO', 'RECHAZADO'];

const colorEstado = (estado) => {
  if (estado === 'APROBADO') return 'bg-green-100 text-green-700';
  if (estado === 'OBSERVADO') return 'bg-yellow-100 text-yellow-700';
  if (estado === 'RECHAZADO') return 'bg-red-100 text-red-600';
  return 'bg-orange-100 text-orange-600';
};

const colorPrioridad = (p) => {
  if (p === 'Alta') return 'bg-red-100 text-red-600';
  if (p === 'Media') return 'bg-yellow-100 text-yellow-600';
  return 'bg-green-100 text-green-700';
};

const formatearFecha = (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const obtenerFechaLocal = () => {
  const hoy = new Date();
  return hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
};

export default function PanelSupervisor({ usuario, correo, usuarioId, onLogout }) {
  const [pestanaActiva, setPestanaActiva] = useState('tramites');
  const [tramites, setTramites] = useState([]);
  const [estaCargando, setEstaCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [tramiteDetalle, setTramiteDetalle] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [modalObservacion, setModalObservacion] = useState(null);
  const [textoObservacion, setTextoObservacion] = useState('');
  const [guardandoObservacion, setGuardandoObservacion] = useState(false);

  const [empleados, setEmpleados] = useState([]);
  const [asistenciaHoy, setAsistenciaHoy] = useState({});
  const [asistenciaRaw, setAsistenciaRaw] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);

  // NUEVO: estados para modal de informe al admin
  const [modalInforme, setModalInforme] = useState(null);
  const [textoInforme, setTextoInforme] = useState('');
  const [enviandoInforme, setEnviandoInforme] = useState(false);

  const cargarTramites = useCallback(async () => {
    setEstaCargando(true);
    try {
      const { data, error } = await supabase
        .from('Tareas')
        .select(`
          id,
          nombre_tramite,
          descripcion,
          prioridad,
          estado,
          observacion,
          created_at,
          url_word,
          operador,
          operador_id,
          usuarios!fk_tareas_operador (id, Nombre, apellido, Email)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const norm = (data || []).map(t => ({
        ...t,
        operador_id: t.operador_id ?? t.usuarios?.id ?? null,
        operador_nombre: t.usuarios
          ? `${t.usuarios.Nombre} ${t.usuarios.apellido || ''}`.trim()
          : t.operador || '—',
        operador_email: t.usuarios?.Email || t.operador || '—',
      }));
      setTramites(norm);
    } catch (err) {
      console.error(err);
    } finally {
      setEstaCargando(false);
    }
  }, []);

  const cargarEmpleados = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .in('Rol', ['empleado', 'supervisor'])
        .order('id', { ascending: true });
      if (error) throw error;
      setEmpleados(data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const cargarAsistenciaHoy = useCallback(async () => {
    try {
      const fechaLocal = obtenerFechaLocal();
      const fechaSiguiente = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      })();
      const { data, error } = await supabase
        .from('asistencia')
        .select('*')
        .gte('fecha', fechaLocal)
        .lte('fecha', fechaSiguiente);
      if (error) throw error;
      const mapa = {};
      const raw = [];
      if (data) {
        data.forEach(r => {
          const registroFecha = r.fecha?.toString().trim();
          if (registroFecha !== fechaLocal && registroFecha !== fechaSiguiente) return;
          raw.push(r);
          const key = r.usuario_id;
          if (key && !mapa[key]) mapa[key] = r;
        });
      }
      setAsistenciaHoy(mapa);
      setAsistenciaRaw(raw);
    } catch (err) {
      console.error(err);
    }
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
    cargarTramites();
    cargarEmpleados();
    cargarAsistenciaHoy();
    cargarNotificaciones();
  }, [cargarTramites, cargarEmpleados, cargarAsistenciaHoy, cargarNotificaciones]);

  useEffect(() => {
    if (!usuarioId) return;
    const canal = supabase
      .channel(`notis_supervisor_${usuarioId}`)
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
        setNotificaciones(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [usuarioId]);

  const marcarLeida = async (id) => {
    await supabase.from('notificaciones').update({ leido: true }).eq('id', id);
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
  };

  const eliminarNotificacion = async (id) => {
    await supabase.from('notificaciones').delete().eq('id', id);
    setNotificaciones(prev => prev.filter(n => n.id !== id));
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    if (nuevoEstado === 'OBSERVADO' || nuevoEstado === 'RECHAZADO') {
      setModalObservacion({ id, estado: nuevoEstado });
      setTextoObservacion('');
      return;
    }
    try {
      const { error } = await supabase
        .from('Tareas')
        .update({ estado: nuevoEstado, observacion: null })
        .eq('id', id);
      if (error) throw error;
      setTramites(tramites.map(t => t.id === id ? { ...t, estado: nuevoEstado, observacion: null } : t));
      if (tramiteDetalle?.id === id) setTramiteDetalle({ ...tramiteDetalle, estado: nuevoEstado, observacion: null });
    } catch (err) {
      alert('No se pudo cambiar el estado.');
    }
  };

  const confirmarObservacion = async () => {
    if (!textoObservacion.trim()) { alert('Debes escribir un motivo.'); return; }
    setGuardandoObservacion(true);
    try {
      const tramite = tramites.find(t => t.id === modalObservacion.id);
      if (!tramite) throw new Error('No se encontro el tramite.');

      const operadorId = tramite.operador_id;
      if (!operadorId) throw new Error('El tramite no tiene operador_id asignado.');

      const { error: errorNoti } = await supabase.from('notificaciones').insert([{
        usuario_id: operadorId,
        tramite_id: modalObservacion.id,
        tipo_notificacion: modalObservacion.estado,
        mensaje: textoObservacion.trim(),
        leido: false
      }]);
      if (errorNoti) throw new Error(`Error en notificaciones: ${errorNoti.message}`);

      const { error: errorTarea } = await supabase.from('Tareas')
        .update({ estado: modalObservacion.estado, observacion: textoObservacion.trim() })
        .eq('id', modalObservacion.id);
      if (errorTarea) throw new Error(`Error en Tareas: ${errorTarea.message}`);

      setTramites(prev => prev.map(t =>
        t.id === modalObservacion.id ? { ...t, estado: modalObservacion.estado, observacion: textoObservacion.trim() } : t
      ));
      if (tramiteDetalle?.id === modalObservacion.id) {
        setTramiteDetalle({ ...tramiteDetalle, estado: modalObservacion.estado, observacion: textoObservacion.trim() });
      }
      setModalObservacion(null);
      setTextoObservacion('');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setGuardandoObservacion(false);
    }
  };

  // NUEVO: enviar informe al admin
  const enviarInformeAlAdmin = async () => {
    if (!textoInforme.trim()) { alert('Escribe un mensaje para el admin.'); return; }
    setEnviandoInforme(true);
    try {
      const { data: admins, error: errorAdmin } = await supabase
        .from('usuarios')
        .select('id')
        .eq('Rol', 'admin')
        .eq('estado', 'activo');

      if (errorAdmin || !admins || admins.length === 0) {
        throw new Error('No se encontro ningun administrador activo.');
      }

      const tramite = modalInforme;
      const mensajeCompleto = tramite
        ? `[Tramite: ${tramite.nombre_tramite}] ${textoInforme.trim()}`
        : textoInforme.trim();

      await Promise.all(admins.map(admin =>
        supabase.from('notificaciones').insert([{
          usuario_id: admin.id,
          tramite_id: tramite?.id || null,
          tipo_notificacion: 'INFORME',
          mensaje: mensajeCompleto,
          leido: false
        }])
      ));

      setModalInforme(null);
      setTextoInforme('');
      alert('Informe enviado al administrador correctamente.');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setEnviandoInforme(false);
    }
  };

  const tramitesFiltrados = tramites
    .filter(t => filtroEstado === 'TODOS' || t.estado === filtroEstado)
    .filter(t =>
      t.nombre_tramite?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.operador_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.operador_email?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const cantidadPresentesHoy = Object.keys(asistenciaHoy).length;
  const noLeidas = notificaciones.filter(n => !n.leido).length;

  const filtros = ['TODOS', 'PENDIENTE', 'APROBADO', 'OBSERVADO', 'RECHAZADO'];

  const pestanas = [
    { id: 'tramites', label: 'Tramites', icon: <ClipboardList size={14} /> },
    { id: 'asistencia', label: 'Asistencia', icon: <Users size={14} /> },
  ];

  const colorNotif = (tipo) => {
    if (tipo === 'RECHAZADO') return 'bg-red-50 border-red-400 text-red-600';
    if (tipo === 'OBSERVADO') return 'bg-yellow-50 border-yellow-400 text-yellow-700';
    return 'bg-green-50 border-green-400 text-green-700';
  };

  return (
    <div className="min-h-screen bg-[#f0fffb] p-6 font-sans tracking-tighter">

      {modalObservacion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md space-y-6">
            <div>
              <h2 className="text-lg font-black text-[#1a4b4c] uppercase">
                {modalObservacion.estado === 'OBSERVADO' ? 'Motivo de Observacion' : 'Motivo de Rechazo'}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Este mensaje le llegara al empleado</p>
            </div>
            <textarea
              className="w-full p-5 bg-[#f8fafc] rounded-2xl outline-none font-bold text-sm border-2 border-transparent focus:border-teal-200 h-32 resize-none"
              placeholder={modalObservacion.estado === 'OBSERVADO' ? 'Ej: Falta la firma del jefe de area...' : 'Ej: El documento no cumple con los requisitos...'}
              value={textoObservacion}
              onChange={(e) => setTextoObservacion(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setModalObservacion(null); setTextoObservacion(''); }}
                className="flex-1 py-4 rounded-2xl font-black text-sm uppercase border-2 border-slate-100 text-slate-400 hover:border-slate-200 transition-all">
                Cancelar
              </button>
              <button onClick={confirmarObservacion} disabled={guardandoObservacion}
                className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase text-white shadow-lg transition-all disabled:opacity-50 ${modalObservacion.estado === 'OBSERVADO' ? 'bg-yellow-400' : 'bg-red-500'}`}>
                {guardandoObservacion ? 'Guardando...' : `Confirmar ${modalObservacion.estado}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO: Modal de informe al admin */}
      {modalInforme !== false && modalInforme !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md space-y-6">
            <div>
              <h2 className="text-lg font-black text-[#1a4b4c] uppercase flex items-center gap-2">
                <MessageSquare size={18} /> Informar al Admin
              </h2>
              {modalInforme?.nombre_tramite && (
                <div className="mt-2 px-3 py-2 bg-teal-50 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tramite</p>
                  <p className="font-black text-sm text-[#1a4b4c] uppercase">{modalInforme.nombre_tramite}</p>
                </div>
              )}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">
                Este mensaje solo lo vera el administrador
              </p>
            </div>
            <textarea
              className="w-full p-5 bg-[#f8fafc] rounded-2xl outline-none font-bold text-sm border-2 border-transparent focus:border-blue-200 h-32 resize-none"
              placeholder="Ej: El tramite tiene documentos faltantes que el empleado no puede subsanar solo..."
              value={textoInforme}
              onChange={(e) => setTextoInforme(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setModalInforme(null); setTextoInforme(''); }}
                className="flex-1 py-4 rounded-2xl font-black text-sm uppercase border-2 border-slate-100 text-slate-400 hover:border-slate-200 transition-all">
                Cancelar
              </button>
              <button onClick={enviarInformeAlAdmin} disabled={enviandoInforme}
                className="flex-1 py-4 rounded-2xl font-black text-sm uppercase text-white shadow-lg transition-all disabled:opacity-50 bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2">
                {enviandoInforme ? 'Enviando...' : <><Send size={14} /> Enviar al Admin</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#1a4b4c] p-6 rounded-[2rem] shadow-lg mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white leading-none uppercase">FocusOS</h1>
          <span className="text-[10px] font-black text-teal-300 tracking-[0.2em] uppercase block">Supervisor: {usuario}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={cargarNotificaciones} className="relative bg-white/10 text-white p-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all">
              <Bell size={16} />
              {noLeidas > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {noLeidas}
                </span>
              )}
            </button>
          </div>
          {/* NUEVO: botón de informe rápido al admin (sin tramite específico) */}
          <button
            onClick={() => { setModalInforme({}); setTextoInforme(''); }}
            className="bg-blue-500/20 text-blue-300 font-black text-[10px] px-4 py-2 rounded-xl border border-blue-400/30 uppercase flex items-center gap-2 hover:bg-blue-500/30 transition-all"
          >
            <MessageSquare size={12} /> Informar al Admin
          </button>
          <button onClick={() => { cargarTramites(); cargarEmpleados(); cargarAsistenciaHoy(); }}
            className="bg-white/10 text-white font-black text-[10px] px-4 py-2 rounded-xl border border-white/20 uppercase flex items-center gap-2 hover:bg-white/20 transition-all">
            <RefreshCcw size={12} /> Actualizar
          </button>
          <button onClick={onLogout}
            className="bg-red-500/20 text-red-300 font-black text-[10px] px-4 py-2 rounded-xl border border-red-400/30 uppercase hover:bg-red-500/30 transition-all">
            Cerrar Sesion
          </button>
        </div>
      </header>

      {notificaciones.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Bell size={12} /> Notificaciones
          </h2>
          {notificaciones.map(n => (
            <div key={n.id} className={`p-5 rounded-[2rem] flex items-start gap-4 border-l-4 ${colorNotif(n.tipo_notificacion)} ${n.leido ? 'opacity-60' : ''}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorEstado(n.tipo_notificacion)}`}>
                    {n.tipo_notificacion}
                  </span>
                  {!n.leido && <span className="px-2 py-0.5 rounded-full bg-[#1a4b4c] text-white font-black text-[9px] uppercase">Nuevo</span>}
                </div>
                <p className="font-bold text-sm mt-1">{n.mensaje}</p>
                {n.creado_en && (
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    {new Date(n.creado_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {!n.leido && (
                  <button onClick={() => marcarLeida(n.id)} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">
                    Marcar leida
                  </button>
                )}
                <button onClick={() => eliminarNotificacion(n.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {pestanas.map(p => (
          <button key={p.id} onClick={() => setPestanaActiva(p.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all ${pestanaActiva === p.id ? 'bg-[#1a4b4c] text-white shadow-lg' : 'bg-white text-slate-400 border border-teal-50 hover:border-teal-200'}`}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {pestanaActiva === 'tramites' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {filtros.map(e => (
              <div key={e} onClick={() => setFiltroEstado(e)}
                className={`p-6 rounded-[2rem] border text-center cursor-pointer transition-all shadow-sm ${filtroEstado === e ? 'bg-[#1a4b4c] text-white border-transparent shadow-lg' : 'bg-white border-teal-50 hover:border-teal-200'}`}>
                <p className={`text-[10px] font-black uppercase ${filtroEstado === e ? 'text-teal-300' : 'text-slate-400'}`}>{e}</p>
                <p className={`text-4xl font-black ${filtroEstado === e ? 'text-white' : 'text-[#1a4b4c]'}`}>
                  {e === 'TODOS' ? tramites.length : tramites.filter(t => t.estado === e).length}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${tramiteDetalle ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-[2.5rem] shadow-sm border border-teal-50 overflow-hidden`}>
              <div className="p-6 border-b border-teal-50 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Tramites — {tramitesFiltrados.length} registros</h2>
                  {estaCargando && <span className="text-[10px] font-black text-teal-400 uppercase animate-pulse">Cargando...</span>}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" placeholder="Buscar por tramite u operador..."
                    className="w-full pl-10 pr-4 py-3 bg-[#f8fafc] rounded-2xl outline-none font-bold text-sm border-2 border-transparent focus:border-teal-200 text-slate-600"
                    value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-50">
                      {['Tramite', 'Operador', 'Prioridad', 'Estado', 'Fecha', 'Acciones'].map(h => (
                        <th key={h} className="text-left p-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tramitesFiltrados.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-20 font-black text-slate-200 uppercase tracking-widest text-sm">No hay tramites</td></tr>
                    )}
                    {tramitesFiltrados.map(t => (
                      <tr key={t.id} className={`border-b border-slate-50 hover:bg-teal-50/30 transition-colors ${tramiteDetalle?.id === t.id ? 'bg-teal-50' : ''}`}>
                        <td className="p-4">
                          <p className="font-black text-sm text-slate-700 uppercase">{t.nombre_tramite}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 line-clamp-1">{t.descripcion}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-black text-xs text-slate-600 uppercase">{t.operador_nombre}</p>
                          <p className="text-[9px] font-bold text-slate-400">{t.operador_email}</p>
                        </td>
                        <td className="p-4"><span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorPrioridad(t.prioridad)}`}>{t.prioridad}</span></td>
                        <td className="p-4"><span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorEstado(t.estado)}`}>{t.estado}</span></td>
                        <td className="p-4"><span className="text-[10px] font-bold text-slate-400">{formatearFecha(t.created_at)}</span></td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button onClick={() => setTramiteDetalle(tramiteDetalle?.id === t.id ? null : t)} className="p-2 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors"><Eye size={14} /></button>
                            <button onClick={() => cambiarEstado(t.id, 'APROBADO')} disabled={t.estado === 'APROBADO'} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-30"><CheckCircle size={14} /></button>
                            <button onClick={() => cambiarEstado(t.id, 'OBSERVADO')} disabled={t.estado === 'OBSERVADO'} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-colors disabled:opacity-30"><XCircle size={14} /></button>
                            <button onClick={() => cambiarEstado(t.id, 'RECHAZADO')} disabled={t.estado === 'RECHAZADO'} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-30"><Trash2 size={14} /></button>
                            {/* NUEVO: botón Informar en cada fila */}
                            <button
                              onClick={() => { setModalInforme(t); setTextoInforme(''); }}
                              className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                              title="Informar al Admin sobre este tramite"
                            >
                              <MessageSquare size={14} />
                            </button>
                            {t.url_word && (
                              <a href={t.url_word} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"><Download size={14} /></a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {tramiteDetalle && (
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-teal-50 p-8 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Detalle</h2>
                  <button onClick={() => setTramiteDetalle(null)} className="text-slate-300 hover:text-slate-500 font-black text-xs uppercase">Cerrar</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Tramite</p>
                    <p className="font-black text-lg text-[#1a4b4c] uppercase">{tramiteDetalle.nombre_tramite}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Descripcion</p>
                    <p className="font-bold text-sm text-slate-600">{tramiteDetalle.descripcion}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Operador</p>
                    <p className="font-black text-sm text-slate-700 uppercase">{tramiteDetalle.operador_nombre}</p>
                    <p className="text-[10px] font-bold text-slate-400">{tramiteDetalle.operador_email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Fecha de Registro</p>
                    <p className="font-bold text-sm text-slate-500">{formatearFecha(tramiteDetalle.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Prioridad</p>
                    <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorPrioridad(tramiteDetalle.prioridad)}`}>{tramiteDetalle.prioridad}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Estado actual</p>
                    <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorEstado(tramiteDetalle.estado)}`}>{tramiteDetalle.estado}</span>
                  </div>
                  {tramiteDetalle.observacion && (
                    <div className={`p-4 rounded-2xl ${tramiteDetalle.estado === 'RECHAZADO' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${tramiteDetalle.estado === 'RECHAZADO' ? 'text-red-400' : 'text-yellow-500'}`}>Motivo</p>
                      <p className={`font-bold text-sm ${tramiteDetalle.estado === 'RECHAZADO' ? 'text-red-600' : 'text-yellow-700'}`}>{tramiteDetalle.observacion}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Cambiar estado</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ESTADOS_TRAMITE.map(e => (
                        <button key={e} onClick={() => cambiarEstado(tramiteDetalle.id, e)}
                          disabled={tramiteDetalle.estado === e}
                          className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all disabled:opacity-30 ${colorEstado(e)}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* NUEVO: botón informar desde el panel de detalle */}
                  <button
                    onClick={() => { setModalInforme(tramiteDetalle); setTextoInforme(''); setTramiteDetalle(null); }}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-blue-50 text-blue-700 rounded-2xl font-black text-xs uppercase hover:bg-blue-100 transition-colors border border-blue-100"
                  >
                    <MessageSquare size={16} /> Informar al Admin
                  </button>
                  {tramiteDetalle.url_word && (
                    <a href={tramiteDetalle.url_word} target="_blank" rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-4 bg-[#1a4b4c] text-white rounded-2xl font-black text-xs uppercase hover:bg-teal-800 transition-colors">
                      <Download size={16} /> Descargar Archivo
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {pestanaActiva === 'asistencia' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div className="bg-white p-6 rounded-[2rem] text-center shadow-sm border border-teal-50">
              <p className="text-[10px] font-black text-slate-400 uppercase">Total Personal</p>
              <p className="text-4xl font-black text-[#1a4b4c]">{empleados.length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] text-center shadow-sm border border-teal-50">
              <p className="text-[10px] font-black text-slate-400 uppercase">Presentes Hoy</p>
              <p className="text-4xl font-black text-green-500">{cantidadPresentesHoy}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] text-center shadow-sm border border-teal-50">
              <p className="text-[10px] font-black text-slate-400 uppercase">Ausentes</p>
              <p className="text-4xl font-black text-red-400">{empleados.length - cantidadPresentesHoy}</p>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-teal-50 overflow-hidden">
            <div className="p-6 border-b border-teal-50 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Asistencia de Hoy — Solo lectura</h2>
                <span className="text-[10px] font-black text-teal-400 uppercase bg-teal-50 px-3 py-1 rounded-full mt-1 inline-block">Vista supervisor</span>
              </div>
              <button
                onClick={() => exportToExcel(asistenciaRaw, empleados, 'Asistencia_Supervisor')}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-black text-[10px] px-4 py-3 rounded-2xl uppercase transition-all shadow-sm"
              >
                <FileDown size={14} /> Exportar Excel
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {empleados.length === 0 && (
                <p className="text-center py-20 font-black text-slate-200 uppercase tracking-widest text-sm">No hay empleados</p>
              )}
              {empleados.map(e => {
                const registro = asistenciaHoy[e.id];
                return (
                  <div key={e.id} className="flex items-center justify-between p-6 hover:bg-teal-50/30 transition-colors">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-sm text-slate-700 uppercase">{e.Nombre} {e.apellido}</p>
                        <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 font-black text-[9px] uppercase">{e.Rol}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">{e.Email}</p>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Entrada</p>
                        <p className="font-black text-xs text-slate-600">{registro ? registro.hora_entrada : '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Salida</p>
                        <p className="font-black text-xs text-slate-600">{registro ? (registro.hora_salida || 'Pendiente') : '—'}</p>
                      </div>
                      <div className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-sm ${registro ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-400'}`}>
                        {registro ? 'Asistio' : 'Ausente'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
