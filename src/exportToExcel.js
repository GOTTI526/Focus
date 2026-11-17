import * as XLSX from 'xlsx';

export function exportToExcel(asistenciaRaw, empleados, nombreArchivo = 'Asistencia') {
  const hoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const filas = empleados.map(e => {
    const reg = asistenciaRaw.find(r => r.usuario_id === e.id);
    return {
      'Nombre': `${e.Nombre} ${e.apellido || ''}`.trim(),
      'Email': e.Email,
      'DNI': e.dni || '—',
      'Rol': e.Rol,
      'Estado Cuenta': e.estado,
      'Fecha': reg?.fecha || hoy,
      'Hora Entrada': reg?.hora_entrada || '—',
      'Hora Salida': reg?.hora_salida || (reg ? 'Pendiente' : '—'),
      'Asistencia': reg ? 'Asistio' : 'Ausente',
    };
  });

  const hoja = XLSX.utils.json_to_sheet(filas);

  hoja['!cols'] = [
    { wch: 25 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Asistencia');
  XLSX.writeFile(libro, `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}