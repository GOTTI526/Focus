import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, Download, CheckCircle, XCircle, Eye, Trash2, UserPlus, Users, ClipboardList, Search, BarChart2, ChevronDown, FileDown, MessageSquare } from 'lucide-react';
import { supabase } from './supabaseClient';
import { exportToExcel } from './exportToExcel';

const ESTADOS_TRAMITE = ['PENDIENTE', 'APROBADO', 'OBSERVADO', 'RECHAZADO'];
const ROL_ID_MAP = { admin: 1, supervisor: 2, empleado: 3 };
const ROLES = ['empleado', 'supervisor', 'admin'];

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

export default function PanelAdmin({ usuario, usuarioId, onLogout }) {
  const [pestanaActiva, setPestanaActiva] = useState('tramites');
  const [tramites, setTramites] = useState([]);
  const [estaCargando, setEstaCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [tramiteDetalle, setTramiteDetalle] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [modalObservacion, setModalObservacion] = useState(null);
  const [textoObservacion, setTextoObservacion] = useState('');
  const [guardandoObservacion, setGuardandoObservacion] = useState(false);

  const [notificacionesVistas, setNotificacionesVistas] = useState({});

  const [informesSupervisor, setInformesSupervisor] = useState([]);
  const [mostrarInformes, setMostrarInformes] = useState(false);

  const [empleados, setEmpleados] = useState([]);
  const [nuevoDni, setNuevoDni] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoApellido, setNuevoApellido] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoCorreoPersonal, setNuevoCorreoPersonal] = useState('');
  const [nuevoRol, setNuevoRol] = useState('empleado');
  const [dropdownRolAbierto, setDropdownRolAbierto] = useState(false);
  const [creandoEmpleado, setCreandoEmpleado] = useState(false);
  const [mensajeEmpleado, setMensajeEmpleado] = useState('');

  const [asistenciaHoy, setAsistenciaHoy] = useState({});
  const [asistenciaRaw, setAsistenciaRaw] = useState([]);

  const cargarNotificacionesVistas = useCallback(async () => {
    const { data } = await supabase
      .from('notificaciones')
      .select('tramite_id, leido')
      .not('tramite_id', 'is', null);
    if (data) {
      const mapa = {};
      data.forEach(n => {
        if (n.tramite_id) {
          if (!(n.tramite_id in mapa)) mapa[n.tramite_id] = n.leido;
          else if (n.leido) mapa[n.tramite_id] = true;
        }
      });
      setNotificacionesVistas(mapa);
    }
  }, []);

  const cargarInformesSupervisor = useCallback(async () => {
    if (!usuarioId) return;
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('tipo_notificacion', 'INFORME')
      .order('creado_en', { ascending: false });
    if (data) setInformesSupervisor(data);
  }, [usuarioId]);

  useEffect(() => {
    cargarNotificacionesVistas();
    cargarInformesSupervisor();

    const canal = supabase
      .channel(`notificaciones_admin_${usuarioId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notificaciones',
      }, (payload) => {
        if (payload.new?.tramite_id && payload.new?.leido) {
          setNotificacionesVistas(prev => ({
            ...prev,
            [payload.new.tramite_id]: true,
          }));
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${usuarioId}`,
      }, (payload) => {
        if (payload.new?.tipo_notificacion === 'INFORME') {
          setInformesSupervisor(prev => [payload.new, ...prev]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [cargarNotificacionesVistas, cargarInformesSupervisor, usuarioId]);

  const marcarInformeLeido = async (id) => {
    await supabase.from('notificaciones').update({ leido: true }).eq('id', id);
    setInformesSupervisor(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
  };

  const eliminarInforme = async (id) => {
    await supabase.from('notificaciones').delete().eq('id', id);
    setInformesSupervisor(prev => prev.filter(n => n.id !== id));
  };

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
      const tramitesNormalizados = (data || []).map(t => ({
        ...t,
        operador_id: t.operador_id ?? t.usuarios?.id ?? null,
        operador_nombre: t.usuarios
          ? `${t.usuarios.Nombre} ${t.usuarios.apellido || ''}`.trim()
          : t.operador || '—',
        operador_email: t.usuarios?.Email || t.operador || '—',
      }));
      setTramites(tramitesNormalizados);
    } catch (err) {
      console.error('Error cargarTramites:', err);
    } finally {
      setEstaCargando(false);
    }
  }, []);

  const cargarEmpleados = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, Nombre, apellido, Email, Rol, estado, dni, telefono, correo_personal, rol_id')
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
      const { data, error } = await supabase
        .from('asistencia')
        .select('*, usuarios!fk_asistencia_usuarios(id, Nombre, apellido, Email)')
        .eq('fecha', fechaLocal);
      if (error) throw error;
      const mapa = {};
      const raw = [];
      (data || []).forEach(r => {
        raw.push(r);
        if (r.usuario_id && !mapa[r.usuario_id]) mapa[r.usuario_id] = r;
      });
      setAsistenciaHoy(mapa);
      setAsistenciaRaw(raw);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    cargarTramites();
    cargarEmpleados();
    cargarAsistenciaHoy();
  }, [cargarTramites, cargarEmpleados, cargarAsistenciaHoy]);

  const cambiarEstado = async (id, nuevoEstado) => {
    if (nuevoEstado === 'OBSERVADO' || nuevoEstado === 'RECHAZADO') {
      setModalObservacion({ id, estado: nuevoEstado });
      setTextoObservacion('');
      return;
    }
    try {
      const { error } = await supabase.from('Tareas').update({ estado: nuevoEstado, observacion: null }).eq('id', id);
      if (error) throw error;
      setTramites(prev => prev.map(t => t.id === id ? { ...t, estado: nuevoEstado, observacion: null } : t));
      setTramiteDetalle(prev => prev?.id === id ? { ...prev, estado: nuevoEstado, observacion: null } : prev);
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
      if (!operadorId) {
        throw new Error(
          `El tramite ID ${modalObservacion.id} no tiene operador_id. ` +
          'Revisa que la columna operador_id de Tareas tenga el id del usuario.'
        );
      }

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

      const observacion = textoObservacion.trim();
      setNotificacionesVistas(prev => ({ ...prev, [modalObservacion.id]: false }));
      setTramites(prev => prev.map(t =>
        t.id === modalObservacion.id ? { ...t, estado: modalObservacion.estado, observacion } : t
      ));
      setTramiteDetalle(prev => prev?.id === modalObservacion.id
        ? { ...prev, estado: modalObservacion.estado, observacion }
        : prev);
      setModalObservacion(null);
      setTextoObservacion('');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setGuardandoObservacion(false);
    }
  };

  const crearEmpleado = async () => {
    setMensajeEmpleado('');
    if (!nuevoDni || !nuevoNombre || !nuevoApellido || !nuevoEmail || !nuevoTelefono || !nuevoCorreoPersonal) {
      setMensajeEmpleado('Completa todos los campos.');
      return;
    }
    setCreandoEmpleado(true);
    try {
      const { error } = await supabase.from('usuarios').insert([{
        dni: nuevoDni.trim(),
        Nombre: nuevoNombre.trim(),
        apellido: nuevoApellido.trim(),
        Email: nuevoEmail.trim().toLowerCase(),
        telefono: nuevoTelefono.trim(),
        correo_personal: nuevoCorreoPersonal.trim(),
        Rol: nuevoRol,
        rol_id: ROL_ID_MAP[nuevoRol],
        estado: 'activo'
      }]);
      if (error) throw error;
      setNuevoDni(''); setNuevoNombre(''); setNuevoApellido('');
      setNuevoEmail(''); setNuevoTelefono('');
      setNuevoCorreoPersonal(''); setNuevoRol('empleado');
      setMensajeEmpleado('Fila creada. Falta crear su cuenta en Authentication y vincular auth_id.');
      cargarEmpleados();
      setTimeout(() => setMensajeEmpleado(''), 6000);
    } catch (err) {
      setMensajeEmpleado('Error al crear. El correo o DNI ya existe.');
    } finally {
      setCreandoEmpleado(false);
    }
  };

  const cambiarEstadoEmpleado = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo';
    try {
      const { error } = await supabase.from('usuarios').update({ estado: nuevoEstado }).eq('id', id);
      if (error) throw error;
      setEmpleados(prev => prev.map(e => e.id === id ? { ...e, estado: nuevoEstado } : e));
    } catch (err) {
      alert('No se pudo cambiar el estado del empleado.');
    }
  };

  const tramitesFiltrados = tramites
    .filter(t => filtroEstado === 'TODOS' || t.estado === filtroEstado)
    .filter(t =>
      t.nombre_tramite?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.operador_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.operador_email?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const soloEmpleados = empleados.filter(e => e.Rol !== 'admin');
  const cantidadPresentesHoy = Object.keys(asistenciaHoy).length;
  const totalTramites = tramites.length || 1;
  const informesNoLeidos = informesSupervisor.filter(n => !n.leido).length;

  const metricaEstados = [
    { label: 'Pendiente', valor: tramites.filter(t => t.estado === 'PENDIENTE').length, color: 'bg-orange-400' },
    { label: 'Aprobado', valor: tramites.filter(t => t.estado === 'APROBADO').length, color: 'bg-green-500' },
    { label: 'Observado', valor: tramites.filter(t => t.estado === 'OBSERVADO').length, color: 'bg-yellow-400' },
    { label: 'Rechazado', valor: tramites.filter(t => t.estado === 'RECHAZADO').length, color: 'bg-red-500' },
  ];

  const metricaPrioridades = [
    { label: 'Alta', valor: tramites.filter(t => t.prioridad === 'Alta').length, color: 'bg-red-500' },
    { label: 'Media', valor: tramites.filter(t => t.prioridad === 'Media').length, color: 'bg-yellow-400' },
    { label: 'Baja', valor: tramites.filter(t => t.prioridad === 'Baja').length, color: 'bg-green-500' },
  ];

  const estiloInput = 'w-full p-4 bg-[#f8fafc] rounded-2xl outline-none font-bold border-2 border-transparent focus:border-teal-200 text-sm uppercase tracking-widest';

  const pestanas = [
    { id: 'tramites', label: 'Tramites', icon: <ClipboardList size={14} /> },
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={14} /> },
    { id: 'empleados', label: 'Empleados', icon: <UserPlus size={14} /> },
    { id: 'asistencia', label: 'Asistencia', icon: <Users size={14} /> },
  ];

  const filtros = ['TODOS', 'PENDIENTE', 'APROBADO', 'OBSERVADO'];

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

      {mostrarInformes && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-lg space-y-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-black text-[#1a4b4c] uppercase flex items-center gap-2">
                  <MessageSquare size={18} /> Informes del Supervisor
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Mensajes enviados por los supervisores
                </p>
              </div>
              <button onClick={() => setMostrarInformes(false)}
                className="text-slate-300 hover:text-slate-500 font-black text-xs uppercase">
                Cerrar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {informesSupervisor.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="font-black text-slate-200 uppercase tracking-widest text-sm">Sin informes</p>
                </div>
              )}
              {informesSupervisor.map(n => (
                <div key={n.id} className={`p-5 rounded-[1.5rem] border-l-4 border-blue-400 transition-all ${n.leido ? 'bg-slate-50 opacity-70' : 'bg-blue-50'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full font-black text-[10px] uppercase bg-blue-100 text-blue-700">
                        Informe Supervisor
                      </span>
                      {!n.leido && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1a4b4c] text-white font-black text-[9px] uppercase">
                          Nuevo
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {!n.leido && (
                        <button onClick={() => marcarInformeLeido(n.id)}
                          className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">
                          Marcar leido
                        </button>
                      )}
                      <button onClick={() => eliminarInforme(n.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors text-[10px] font-black uppercase">
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <p className="font-bold text-sm text-slate-700 mt-1">{n.mensaje}</p>
                  {n.creado_en && (
                    <p className="text-[10px] font-bold text-slate-400 mt-2">
                      {new Date(n.creado_en).toLocaleString('es-PE', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#1a4b4c] p-6 rounded-[2rem] shadow-lg mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white leading-none uppercase">FocusOS</h1>
          <span className="text-[10px] font-black text-teal-300 tracking-[0.2em] uppercase block">Admin: {usuario}</span>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => {
              setMostrarInformes(true);
              informesSupervisor.filter(n => !n.leido).forEach(n => marcarInformeLeido(n.id));
            }}
            className="relative bg-blue-500/20 text-blue-300 font-black text-[10px] px-4 py-2 rounded-xl border border-blue-400/30 uppercase flex items-center gap-2 hover:bg-blue-500/30 transition-all"
          >
            <MessageSquare size={12} /> Informes
            {informesNoLeidos > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {informesNoLeidos}
              </span>
            )}
          </button>
          <button onClick={() => { cargarTramites(); cargarEmpleados(); cargarAsistenciaHoy(); cargarNotificacionesVistas(); cargarInformesSupervisor(); }}
            className="bg-white/10 text-white font-black text-[10px] px-4 py-2 rounded-xl border border-white/20 uppercase flex items-center gap-2 hover:bg-white/20 transition-all">
            <RefreshCcw size={12} /> Actualizar
          </button>
          <button onClick={onLogout}
            className="bg-red-500/20 text-red-300 font-black text-[10px] px-4 py-2 rounded-xl border border-red-400/30 uppercase hover:bg-red-500/30 transition-all">
            Cerrar Sesion
          </button>
        </div>
      </header>

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                      {['Tramite', 'Operador', 'Prioridad', 'Estado', 'Visto', 'Fecha', 'Acciones'].map(h => (
                        <th key={h} className="text-left p-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tramitesFiltrados.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-20 font-black text-slate-200 uppercase tracking-widest text-sm">No hay tramites</td></tr>
                    )}
                    {tramitesFiltrados.map(t => {
                      const tieneNotif = t.id in notificacionesVistas;
                      const visto = notificacionesVistas[t.id] === true;
                      return (
                        <tr key={t.id} className={`border-b border-slate-50 hover:bg-teal-50/30 transition-colors ${tramiteDetalle?.id === t.id ? 'bg-teal-50' : ''}`}>
                          <td className="p-4">
                            <p className="font-black text-sm text-slate-700 uppercase">{t.nombre_tramite}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 line-clamp-1">{t.descripcion}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-black text-xs text-slate-600 uppercase">{t.operador_nombre}</p>
                            <p className="text-[9px] font-bold text-slate-400">{t.operador_email}</p>
                            {!t.operador_id && (
                              <p className="text-[8px] font-black text-orange-400 uppercase">sin id</p>
                            )}
                          </td>
                          <td className="p-4"><span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorPrioridad(t.prioridad)}`}>{t.prioridad}</span></td>
                          <td className="p-4"><span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${colorEstado(t.estado)}`}>{t.estado}</span></td>
                          <td className="p-4">
                            {tieneNotif ? (
                              <div className="flex items-center gap-1.5">
                                <Eye size={16} className={visto ? 'text-teal-500' : 'text-slate-300'} />
                                <span className={`text-[9px] font-black uppercase ${visto ? 'text-teal-500' : 'text-slate-300'}`}>
                                  {visto ? 'Visto' : 'Sin ver'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-black text-slate-200 uppercase">—</span>
                            )}
                          </td>
                          <td className="p-4"><span className="text-[10px] font-bold text-slate-400">{formatearFecha(t.created_at)}</span></td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button onClick={() => setTramiteDetalle(tramiteDetalle?.id === t.id ? null : t)} className="p-2 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors"><Eye size={14} /></button>
                              <button onClick={() => cambiarEstado(t.id, 'APROBADO')} disabled={t.estado === 'APROBADO'} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-30"><CheckCircle size={14} /></button>
                              <button onClick={() => cambiarEstado(t.id, 'OBSERVADO')} disabled={t.estado === 'OBSERVADO'} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-colors disabled:opacity-30"><XCircle size={14} /></button>
                              <button onClick={() => cambiarEstado(t.id, 'RECHAZADO')} disabled={t.estado === 'RECHAZADO'} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-30"><Trash2 size={14} /></button>
                              {t.url_word && (
                                <a href={t.url_word} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><Download size={14} /></a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
                    {!tramiteDetalle.operador_id && (
                      <p className="text-[9px] font-black text-orange-400 uppercase mt-1">
                        Este tramite no tiene operador_id asignado
                      </p>
                    )}
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
                  {tramiteDetalle.id in notificacionesVistas && (
                    <div className={`flex items-center gap-2 p-3 rounded-2xl ${notificacionesVistas[tramiteDetalle.id] ? 'bg-teal-50' : 'bg-slate-50'}`}>
                      <Eye size={14} className={notificacionesVistas[tramiteDetalle.id] ? 'text-teal-500' : 'text-slate-300'} />
                      <span className={`font-black text-[10px] uppercase ${notificacionesVistas[tramiteDetalle.id] ? 'text-teal-600' : 'text-slate-400'}`}>
                        {notificacionesVistas[tramiteDetalle.id] ? 'El empleado ya vio la notificacion' : 'El empleado aun no la ve'}
                      </span>
                    </div>
                  )}
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

      {pestanaActiva === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metricaEstados.map(m => (
              <div key={m.label} className="bg-white p-6 rounded-[2rem] border border-teal-50 shadow-sm text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{m.label}</p>
                <p className="text-4xl font-black text-[#1a4b4c] mb-3">{m.valor}</p>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`${m.color} h-2 rounded-full transition-all duration-500`} style={{ width: `${Math.round((m.valor / totalTramites) * 100)}%` }} />
                </div>
                <p className="text-[10px] font-black text-slate-300 mt-1">{Math.round((m.valor / totalTramites) * 100)}%</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-teal-50 shadow-sm">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Tramites por Estado</h2>
              <div className="space-y-4">
                {metricaEstados.map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-black text-slate-600 uppercase">{m.label}</span>
                      <span className="text-xs font-black text-slate-400">{m.valor} tramites</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div className={`${m.color} h-3 rounded-full transition-all duration-700`} style={{ width: `${Math.round((m.valor / totalTramites) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-teal-50 shadow-sm">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Tramites por Prioridad</h2>
              <div className="space-y-4">
                {metricaPrioridades.map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-black text-slate-600 uppercase">{m.label}</span>
                      <span className="text-xs font-black text-slate-400">{m.valor} tramites</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div className={`${m.color} h-3 rounded-full transition-all duration-700`} style={{ width: `${Math.round((m.valor / totalTramites) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#1a4b4c] p-8 rounded-[2.5rem] shadow-sm lg:col-span-2">
              <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6">Resumen General</h2>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-5xl font-black text-white">{tramites.length}</p>
                  <p className="text-[10px] font-black text-teal-300 uppercase tracking-widest mt-1">Total Tramites</p>
                </div>
                <div>
                  <p className="text-5xl font-black text-white">{soloEmpleados.length}</p>
                  <p className="text-[10px] font-black text-teal-300 uppercase tracking-widest mt-1">Personal</p>
                </div>
                <div>
                  <p className="text-5xl font-black text-white">{cantidadPresentesHoy}</p>
                  <p className="text-[10px] font-black text-teal-300 uppercase tracking-widest mt-1">Presentes Hoy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pestanaActiva === 'empleados' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-teal-50">
            <h2 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest">Nuevo Personal</h2>
            <div className="space-y-3">
              <input type="text" placeholder="DNI" className={estiloInput} value={nuevoDni} onChange={(e) => setNuevoDni(e.target.value)} />
              <input type="text" placeholder="NOMBRE" className={estiloInput} value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
              <input type="text" placeholder="APELLIDO" className={estiloInput} value={nuevoApellido} onChange={(e) => setNuevoApellido(e.target.value)} />
              <input type="text" placeholder="CORREO@FOCUSOS.COM" className={estiloInput} value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} />
              <input type="text" placeholder="TELEFONO" className={estiloInput} value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} />
              <input type="text" placeholder="CORREO PERSONAL (GMAIL)" className={estiloInput} value={nuevoCorreoPersonal} onChange={(e) => setNuevoCorreoPersonal(e.target.value)} />
              <div className="relative">
                <button onClick={() => setDropdownRolAbierto(!dropdownRolAbierto)}
                  className="w-full p-4 bg-[#f8fafc] rounded-2xl outline-none font-bold border-2 border-transparent text-sm uppercase tracking-widest flex items-center justify-between text-slate-600">
                  <span>{nuevoRol}</span>
                  <ChevronDown size={16} className={`transition-transform ${dropdownRolAbierto ? 'rotate-180' : ''}`} />
                </button>
                {dropdownRolAbierto && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-teal-50 z-10 overflow-hidden">
                    {ROLES.map(rol => (
                      <button key={rol} onClick={() => { setNuevoRol(rol); setDropdownRolAbierto(false); }}
                        className={`w-full p-4 text-left font-black text-sm uppercase tracking-widest hover:bg-teal-50 transition-colors ${nuevoRol === rol ? 'text-[#1a4b4c] bg-teal-50' : 'text-slate-500'}`}>
                        {rol}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={crearEmpleado} disabled={creandoEmpleado}
                className="w-full bg-[#1a4b4c] text-white py-4 rounded-2xl font-black text-sm uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50">
                {creandoEmpleado ? 'Creando...' : '+ Crear'}
              </button>
              {mensajeEmpleado && (
                <p className={`font-bold text-xs uppercase text-center ${mensajeEmpleado.includes('creada') ? 'text-green-500' : 'text-red-400'}`}>
                  {mensajeEmpleado}
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-teal-50 overflow-hidden">
            <div className="p-6 border-b border-teal-50 flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Personal Registrado — {soloEmpleados.length}</h2>
              <div className="flex gap-3 text-[10px] font-black uppercase">
                <span className="text-green-500">Activos: {soloEmpleados.filter(e => e.estado === 'activo').length}</span>
                <span className="text-red-400">Inactivos: {soloEmpleados.filter(e => e.estado === 'inactivo').length}</span>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {soloEmpleados.length === 0 && (
                <p className="text-center py-20 font-black text-slate-200 uppercase tracking-widest text-sm">No hay personal</p>
              )}
              {soloEmpleados.map(e => (
                <div key={e.id} className="flex items-center justify-between p-6 hover:bg-teal-50/30 transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm text-slate-700 uppercase">{e.Nombre} {e.apellido}</p>
                      <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 font-black text-[9px] uppercase">{e.Rol}</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">{e.Email}</p>
                    {e.dni && <p className="text-[10px] font-bold text-slate-300">DNI: {e.dni}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase ${e.estado === 'activo' ? 'text-green-500' : 'text-red-400'}`}>
                      {e.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                    <button onClick={() => cambiarEstadoEmpleado(e.id, e.estado)}
                      className={`relative w-14 h-7 rounded-full transition-all duration-300 ${e.estado === 'activo' ? 'bg-[#1a4b4c]' : 'bg-slate-200'}`}>
                      <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${e.estado === 'activo' ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pestanaActiva === 'asistencia' && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-teal-50 overflow-hidden">
          <div className="p-6 border-b border-teal-50 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Control de Asistencia de Hoy</h2>
              <div className="flex gap-4 text-[10px] font-black uppercase mt-1">
                <span className="text-green-500">Presentes: {cantidadPresentesHoy}</span>
                <span className="text-slate-400">Faltas: {soloEmpleados.length - cantidadPresentesHoy}</span>
              </div>
            </div>
            <button
              onClick={() => exportToExcel(asistenciaRaw, soloEmpleados, 'Asistencia_Admin')}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-black text-[10px] px-4 py-3 rounded-2xl uppercase transition-all shadow-sm"
            >
              <FileDown size={14} /> Exportar Excel
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {soloEmpleados.length === 0 && (
              <p className="text-center py-20 font-black text-slate-200 uppercase tracking-widest text-sm">No hay personal</p>
            )}
            {soloEmpleados.map(e => {
              const registro = asistenciaHoy[e.id];
              return (
                <div key={e.id} className="flex items-center justify-between p-6 hover:bg-teal-50/30 transition-colors">
                  <div className="flex flex-col gap-1">
                    <p className="font-black text-sm text-slate-700 uppercase">{e.Nombre} {e.apellido}</p>
                    <p className="text-[10px] font-bold text-slate-400">{e.Email}</p>
                    <span className={`text-[9px] font-black uppercase ${e.estado === 'activo' ? 'text-green-500' : 'text-red-400'}`}>
                      {e.estado === 'activo' ? 'Trabajando' : 'Ya no trabaja'}
                    </span>
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
      )}
    </div>
  );
}