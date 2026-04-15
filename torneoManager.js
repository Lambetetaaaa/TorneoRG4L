// src/torneoManager.js
// Gestión completa de torneos en memoria

class TorneoManager {
  constructor() {
    // Mapa de torneos activos: channelId -> torneo
    this.torneos = new Map();
    // Historial de torneos terminados
    this.historial = [];
  }

  // ─────────────────────────────────────────
  // CREAR TORNEO
  // ─────────────────────────────────────────
  crearTorneo({ guildId, channelId, nombre, juego, maxJugadores, tipo, adminId }) {
    if (this.torneos.has(channelId)) {
      return { error: '⚠️ Ya hay un torneo activo en este canal.' };
    }

    const torneo = {
      id: Date.now().toString(),
      guildId,
      channelId,
      nombre,
      juego,
      maxJugadores: parseInt(maxJugadores),
      tipo,
      adminId,
      jugadores: [],         // [{ id, username, tag }]
      estado: 'registro',    // registro | iniciado | finalizado
      partidas: [],          // brackets generados
      ronda: 1,
      ganador: null,
      messageId: null,       // ID del mensaje embed principal
      creadoEn: new Date(),
      timers: {},            // timers activos por partida
    };

    this.torneos.set(channelId, torneo);
    return { torneo };
  }

  // ─────────────────────────────────────────
  // UNIRSE AL TORNEO
  // ─────────────────────────────────────────
  unirse(channelId, usuario) {
    const torneo = this.torneos.get(channelId);
    if (!torneo) return { error: '❌ No hay ningún torneo activo en este canal.' };
    if (torneo.estado !== 'registro') return { error: '❌ El torneo ya ha iniciado. No puedes unirte.' };

    const yaInscrito = torneo.jugadores.find(j => j.id === usuario.id);
    if (yaInscrito) return { error: '❌ Ya estás inscrito en el torneo.' };

    if (torneo.jugadores.length >= torneo.maxJugadores) {
      return { error: '⚠️ El torneo está lleno.' };
    }

    torneo.jugadores.push({
      id: usuario.id,
      username: usuario.username,
      displayName: usuario.displayName || usuario.username,
    });

    return { torneo, mensaje: `✅ **${usuario.displayName || usuario.username}** se unió al torneo.` };
  }

  // ─────────────────────────────────────────
  // SALIR DEL TORNEO
  // ─────────────────────────────────────────
  salir(channelId, userId) {
    const torneo = this.torneos.get(channelId);
    if (!torneo) return { error: '❌ No hay ningún torneo activo en este canal.' };
    if (torneo.estado !== 'registro') return { error: '❌ No puedes salir después de que el torneo ha iniciado.' };

    const idx = torneo.jugadores.findIndex(j => j.id === userId);
    if (idx === -1) return { error: '❌ No estás inscrito en el torneo.' };

    const jugador = torneo.jugadores.splice(idx, 1)[0];
    return { torneo, mensaje: `👋 **${jugador.displayName}** salió del torneo.` };
  }

  // ─────────────────────────────────────────
  // INICIAR TORNEO (genera brackets)
  // ─────────────────────────────────────────
  iniciarTorneo(channelId) {
    const torneo = this.torneos.get(channelId);
    if (!torneo) return { error: '❌ No hay ningún torneo activo en este canal.' };
    if (torneo.estado !== 'registro') return { error: '❌ El torneo ya fue iniciado.' };
    if (torneo.jugadores.length < 2) return { error: '⚠️ Se necesitan al menos 2 jugadores para iniciar.' };

    torneo.estado = 'iniciado';
    torneo.partidas = this._generarBrackets(torneo.jugadores, torneo.ronda);

    return { torneo };
  }

  // ─────────────────────────────────────────
  // REPORTAR GANADOR DE PARTIDA
  // ─────────────────────────────────────────
  reportarGanador(channelId, partidaId, ganadorId) {
    const torneo = this.torneos.get(channelId);
    if (!torneo) return { error: '❌ No hay torneo activo.' };

    const partida = torneo.partidas.find(p => p.id === partidaId);
    if (!partida) return { error: '❌ Partida no encontrada.' };
    if (partida.ganador) return { error: '⚠️ Esta partida ya tiene ganador.' };

    // Verificar que el que reporta es participante
    const esParticipante = partida.jugador1.id === ganadorId || partida.jugador2?.id === ganadorId;
    if (!esParticipante) return { error: '❌ Solo los participantes pueden reportar el ganador.' };

    const ganador = [partida.jugador1, partida.jugador2].find(j => j?.id === ganadorId);
    partida.ganador = ganador;
    partida.terminada = true;

    // Verificar si la ronda terminó
    const partidasPendientes = torneo.partidas.filter(p => !p.terminada);
    
    if (partidasPendientes.length === 0) {
      const ganadores = torneo.partidas.map(p => p.ganador).filter(Boolean);
      
      if (ganadores.length === 1) {
        // 🏆 TORNEO TERMINADO
        torneo.estado = 'finalizado';
        torneo.ganador = ganadores[0];
        this.historial.push({ ...torneo, finalizadoEn: new Date() });
        this.torneos.delete(channelId);
        return { torneo, torneoTerminado: true, ganador: ganadores[0] };
      } else {
        // Siguiente ronda
        torneo.ronda++;
        torneo.partidas = this._generarBrackets(ganadores, torneo.ronda);
        return { torneo, nuevaRonda: true, ronda: torneo.ronda };
      }
    }

    return { torneo, partida };
  }

  // ─────────────────────────────────────────
  // CANCELAR TORNEO
  // ─────────────────────────────────────────
  cancelarTorneo(channelId) {
    const torneo = this.torneos.get(channelId);
    if (!torneo) return { error: '❌ No hay ningún torneo activo en este canal.' };

    this.torneos.delete(channelId);
    return { torneo, mensaje: '🚫 Torneo cancelado.' };
  }

  // ─────────────────────────────────────────
  // OBTENER TORNEO
  // ─────────────────────────────────────────
  obtenerTorneo(channelId) {
    return this.torneos.get(channelId) || null;
  }

  // ─────────────────────────────────────────
  // GENERAR BRACKETS (eliminación directa)
  // ─────────────────────────────────────────
  _generarBrackets(jugadores, ronda) {
    const mezclados = [...jugadores].sort(() => Math.random() - 0.5);
    const partidas = [];

    for (let i = 0; i < mezclados.length; i += 2) {
      const jugador1 = mezclados[i];
      const jugador2 = mezclados[i + 1] || null; // BYE si número impar

      const partida = {
        id: `r${ronda}m${Math.floor(i / 2) + 1}`,
        numero: Math.floor(i / 2) + 1,
        ronda,
        jugador1,
        jugador2,
        ganador: jugador2 ? null : jugador1, // BYE: pasa automáticamente
        terminada: !jugador2,
      };

      partidas.push(partida);
    }

    return partidas;
  }

  // ─────────────────────────────────────────
  // HISTORIAL
  // ─────────────────────────────────────────
  obtenerHistorial(guildId) {
    return this.historial.filter(t => t.guildId === guildId).slice(-10);
  }
}

module.exports = new TorneoManager();
