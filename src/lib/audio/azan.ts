"use client";

/**
 * Pemutar audio azan AZANUSA.
 *
 * Batasan platform (jujur di UI):
 * - Browser/PWA Android TIDAK menjamin audio azan berbunyi saat aplikasi
 *   ditutup/latar belakang. Pemutaran hanya andal saat aplikasi terbuka dan
 *   audio telah "dibuka" lewat interaksi pengguna (kebijakan autoplay).
 * - Untuk alarm azan yang selalu berbunyi, diperlukan aplikasi Android native
 *   (arsitektur penyedia data & pengaturan AZANUSA sudah dirancang agar mudah
 *   dikembangkan ke arah tersebut).
 */

export type AudioStyle = "azan" | "chime" | "silent";

class AzanPlayer {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private unlocked = false;
  volume = 0.8;
  /** Callback opsional saat azan selesai diputar (untuk sinkron UI) */
  onEnded: (() => void) | null = null;

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.audio) {
      this.audio = new Audio("/audio/azan.mp3");
      this.audio.preload = "auto";
      this.audio.addEventListener("ended", () => {
        this.audio?.pause();
        this.onEnded?.();
      });
    }
    this.audio.volume = this.volume;
    return this.audio;
  }

  /** Wajib dipanggil dari gestur pengguna (tombol) agar autoplay policy terpenuhi */
  async unlock(): Promise<boolean> {
    try {
      const audio = this.ensureAudio();
      if (!audio) return false;
      const prevVol = audio.volume;
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = prevVol;
      this.unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.audio) this.audio.volume = this.volume;
  }

  async playAzan(): Promise<void> {
    const audio = this.ensureAudio();
    if (!audio) return;
    audio.volume = this.volume;
    try {
      await audio.play();
    } catch {
      // autoplay ditolak — abaikan secara diam (UI sudah menjelaskan batasan)
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  isPlaying(): boolean {
    return Boolean(this.audio && !this.audio.paused);
  }

  /** Nada pengingat singkat (dibangkitkan WebAudio, tanpa file, orisinal) */
  playChime(): void {
    if (typeof window === "undefined") return;
    try {
      this.ctx = this.ctx ?? new AudioContext();
      const ctx = this.ctx;
      if (ctx.state === "suspended") return; // butuh gestur pengguna
      const t0 = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99]; // C5 E5 G5 — lembut
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, t0 + i * 0.25);
        gain.gain.linearRampToValueAtTime(0.6 * this.volume, t0 + i * 0.25 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.25 + 0.9);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + i * 0.25);
        osc.stop(t0 + i * 0.25 + 1);
      });
    } catch {
      // abaikan
    }
  }
}

export const azanPlayer = new AzanPlayer();
