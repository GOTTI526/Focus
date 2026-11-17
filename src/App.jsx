import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import PanelEmpleado from './PanelEmpleado';
import PanelAdmin from './PanelAdmin';
import PanelSupervisor from './PanelSupervisor';

import bg1 from './assets/bg1.jpg';
import bg2 from './assets/bg2.jpg';
import bg3 from './assets/bg3.jpg';

const imagenes = [bg1, bg2, bg3];

function normalizarRol(rol) {
  const r = (rol || '').toLowerCase();
  if (r === 'administración' || r === 'administracion' || r === 'admin') return 'admin';
  if (r === 'supervisor') return 'supervisor';
  return 'empleado';
}

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const recuperandoRef = useRef(false);

  const [imagenActual, setImagenActual] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [vista, setVista] = useState('login');
  const [estaCargando, setEstaCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [emailRecuperacion, setEmailRecuperacion] = useState('');
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmarPass, setConfirmarPass] = useState('');

  useEffect(() => {
    const intervalo = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setImagenActual(prev => (prev + 1) % imagenes.length);
        setFadeIn(true);
      }, 800);
    }, 5000);
    return () => clearInterval(intervalo);
  }, []);

  async function obtenerPerfil(user) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, Nombre, Rol, estado, Email')
      .eq('auth_id', user.id)
      .single();

    if (error || !data) {
      await supabase.auth.signOut();
      setMensajeError('Tu cuenta no está vinculada a un usuario de FocusOS.');
      return null;
    }
    if (data.estado === 'inactivo') {
      await supabase.auth.signOut();
      setMensajeError('Tu cuenta esta desactivada. Contacta al administrador.');
      return null;
    }
    return {
      id: data.id,
      nombre: data.Nombre.toUpperCase(),
      rol: normalizarRol(data.Rol),
      correo: data.Email,
    };
  }

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recuperandoRef.current = true;
        setVista('nuevaPassword');
        setCargandoSesion(false);
      }
      if (event === 'SIGNED_OUT') setSesion(null);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && !recuperandoRef.current) {
        setSesion(await obtenerPerfil(data.session.user));
      }
      setCargandoSesion(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setSesion(null);
  }

  if (cargandoSesion) return null;

  if (sesion) {
    if (sesion.rol === 'admin') return <PanelAdmin usuario={sesion.nombre} usuarioId={sesion.id} onLogout={cerrarSesion} />;
    if (sesion.rol === 'supervisor') return <PanelSupervisor usuario={sesion.nombre} correo={sesion.correo} usuarioId={sesion.id} onLogout={cerrarSesion} />;
    return <PanelEmpleado usuario={sesion.nombre} correo={sesion.correo} usuarioId={sesion.id} onLogout={cerrarSesion} />;
  }

  const iniciarSesion = async () => {
    setMensajeError('');
    if (!inputUser || !inputPass) { setMensajeError('Ingresa tus credenciales.'); return; }
    setEstaCargando(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: inputUser.trim().toLowerCase(),
      password: inputPass,
    });
    if (error || !data.user) {
      setMensajeError('Correo o contrasena incorrectos.');
    } else {
      const perfil = await obtenerPerfil(data.user);
      if (perfil) setSesion(perfil);
    }
    setInputPass('');
    setEstaCargando(false);
  };

  const enviarEnlace = async () => {
    setMensajeError('');
    if (!emailRecuperacion.trim()) { setMensajeError('Ingresa tu correo de empresa.'); return; }
    setEstaCargando(true);
    await supabase.auth.resetPasswordForEmail(emailRecuperacion.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    setMensajeExito('Si el correo existe, recibirás un enlace para cambiar tu contraseña.');
    setEstaCargando(false);
  };

  const guardarNuevaPass = async () => {
    setMensajeError('');
    if (!nuevaPass || nuevaPass.length < 8) { setMensajeError('Minimo 8 caracteres.'); return; }
    if (nuevaPass !== confirmarPass) { setMensajeError('Las contrasenas no coinciden.'); return; }
    setEstaCargando(true);
    const { error } = await supabase.auth.updateUser({ password: nuevaPass });
    if (error) {
      setEstaCargando(false);
      setMensajeError('No se pudo actualizar. Intenta de nuevo.');
      return;
    }
    await supabase.auth.signOut();
    recuperandoRef.current = false;
    setNuevaPass(''); setConfirmarPass('');
    setEstaCargando(false);
    setVista('login');
    setMensajeExito('Contrasena actualizada. Ya puedes iniciar sesion.');
  };

  const estiloInput = 'w-full p-4 bg-white/10 backdrop-blur-sm rounded-2xl outline-none font-bold border border-white/30 text-center text-white placeholder:text-white/50 uppercase tracking-widest focus:border-white/60 transition-all';
  const estiloBtn = 'w-full py-4 rounded-2xl font-black text-sm shadow-lg uppercase active:scale-95 transition-all disabled:opacity-50';

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 font-sans tracking-tighter overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{ backgroundImage: `url(${imagenes[imagenActual]})`, opacity: fadeIn ? 1 : 0 }} />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-10 rounded-[3rem] shadow-2xl text-center">
          <h1 className="text-5xl font-black text-white mb-1 uppercase tracking-tight">FocusOS</h1>
          <p className="text-[10px] font-black text-white/60 mb-8 tracking-[0.3em] uppercase">Gestion Administrativa v1.0.4</p>

          {vista === 'login' && (
            <div className="space-y-4">
              <input type="text" placeholder="CORREO EMPRESA" className={estiloInput}
                value={inputUser} onChange={(e) => setInputUser(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && iniciarSesion()} />
              <input type="password" placeholder="CONTRASENA" className={estiloInput}
                value={inputPass} onChange={(e) => setInputPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && iniciarSesion()} />
              <button className={`${estiloBtn} bg-white text-[#1a4b4c]`} disabled={estaCargando} onClick={iniciarSesion}>
                {estaCargando ? 'Verificando...' : 'Iniciar Operacion'}
              </button>
              <button className="w-full text-white/60 font-black text-xs uppercase tracking-widest pt-2 hover:text-white transition-colors"
                onClick={() => { setMensajeError(''); setMensajeExito(''); setVista('olvidarPass'); }}>
                Olvide mi contraseña
              </button>
              {mensajeError && <p className="text-red-300 font-bold text-xs uppercase">{mensajeError}</p>}
              {mensajeExito && <p className="text-green-300 font-bold text-xs uppercase">{mensajeExito}</p>}
            </div>
          )}

          {vista === 'olvidarPass' && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Ingresa tu correo de empresa</p>
              <input type="text" placeholder="CORREO@FOCUSOS.COM" className={estiloInput}
                value={emailRecuperacion} onChange={(e) => setEmailRecuperacion(e.target.value)} />
              <button className={`${estiloBtn} bg-white text-[#1a4b4c]`} onClick={enviarEnlace} disabled={estaCargando}>
                {estaCargando ? 'Enviando...' : 'Enviar Enlace'}
              </button>
              <button className="w-full text-white/50 font-black text-xs uppercase tracking-widest pt-1 hover:text-white transition-colors"
                onClick={() => { setVista('login'); setMensajeError(''); setMensajeExito(''); setEmailRecuperacion(''); }}>
                Volver
              </button>
              {mensajeError && <p className="text-red-300 font-bold text-xs uppercase">{mensajeError}</p>}
              {mensajeExito && <p className="text-green-300 font-bold text-xs uppercase">{mensajeExito}</p>}
            </div>
          )}

          {vista === 'nuevaPassword' && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Crea tu nueva contraseña</p>
              <input type="password" placeholder="NUEVA CONTRASENA" className={estiloInput}
                value={nuevaPass} onChange={(e) => setNuevaPass(e.target.value)} />
              <input type="password" placeholder="CONFIRMAR CONTRASENA" className={estiloInput}
                value={confirmarPass} onChange={(e) => setConfirmarPass(e.target.value)} />
              <button className={`${estiloBtn} bg-white text-[#1a4b4c]`} onClick={guardarNuevaPass} disabled={estaCargando}>
                {estaCargando ? 'Guardando...' : 'Guardar Contrasena'}
              </button>
              {mensajeError && <p className="text-red-300 font-bold text-xs uppercase">{mensajeError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}