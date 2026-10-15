import { CropId } from '../types/crop';

/**
 * Model Data Bertingkat TaniAdapt (Langkah 2 PROMPT G1)
 *
 * Kebun (opsional)
 *  └ Lahan: nama, kab/kota, koordinat, elevasi, kelas_tanah,
 *           sumber_air (tadah_hujan | irigasi), mulsa (ya | tidak)
 *     └ Penanaman: komoditas, tanggal_tanam, panen_kering
 *        └ Kejadian: jenis (siram | pupuk | catatan), tanggal, kedalaman_mm (nullable)
 */

export type SumberAir = 'tadah_hujan' | 'irigasi';
export type KelasTanah = 'loam' | 'clay' | 'sandy_loam' | 'clay_loam' | 'andosol';

export interface Kejadian {
  id: string;
  jenis: 'siram' | 'pupuk' | 'catatan';
  tanggal: string; // ISO format YYYY-MM-DD
  catatan: string;
  kedalaman_mm?: number | null;
  cuaca_saat_kejadian?: string;
}

export interface Penanaman {
  id: string;
  komoditas: CropId;
  tanggal_tanam: string; // ISO format YYYY-MM-DD
  panen_kering: boolean; // Khusus jagung/kedelai (Kc late 0.35 vs 0.60)
  varietas?: string;
  kejadian: Kejadian[];
  status_aktif: boolean;
}

export interface Lahan {
  id: string;
  nama: string;
  kabkota: string;
  locationId: string;
  latitude: number;
  longitude: number;
  elevasi_mdpl: number; // Single source of truth per lahan
  kelas_tanah: KelasTanah;
  sumber_air: SumberAir;
  mulsa: boolean;
  penanaman_aktif?: Penanaman;
  riwayat_penanaman: Penanaman[];
}

/**
 * Antarmuka PlotRepository agar penyimpanan (saat ini localStorage)
 * dapat diganti ke database/server tanpa mengubah kode UI (Langkah 2 PROMPT G1).
 */
export interface PlotRepository {
  getAllLahan(): Promise<Lahan[]>;
  getLahanById(id: string): Promise<Lahan | null>;
  saveLahan(lahan: Lahan): Promise<void>;
  updateLahan(lahan: Lahan): Promise<void>;
  deleteLahan(id: string): Promise<void>;
  addKejadian(lahanId: string, penanamanId: string, kejadian: Kejadian): Promise<void>;
}

const STORAGE_KEY = 'taniadapt_lahan_repository_v1';

export class LocalStoragePlotRepository implements PlotRepository {
  private getStore(): Lahan[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveStore(store: Lahan[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  async getAllLahan(): Promise<Lahan[]> {
    return this.getStore();
  }

  async getLahanById(id: string): Promise<Lahan | null> {
    const store = this.getStore();
    return store.find(l => l.id === id) || null;
  }

  async saveLahan(lahan: Lahan): Promise<void> {
    const store = this.getStore();
    const idx = store.findIndex(l => l.id === lahan.id);
    if (idx >= 0) {
      store[idx] = lahan;
    } else {
      store.push(lahan);
    }
    this.saveStore(store);
  }

  async updateLahan(lahan: Lahan): Promise<void> {
    return this.saveLahan(lahan);
  }

  async deleteLahan(id: string): Promise<void> {
    const store = this.getStore().filter(l => l.id !== id);
    this.saveStore(store);
  }

  async addKejadian(lahanId: string, penanamanId: string, kejadian: Kejadian): Promise<void> {
    const store = this.getStore();
    const lahan = store.find(l => l.id === lahanId);
    if (!lahan) return;

    if (lahan.penanaman_aktif && lahan.penanaman_aktif.id === penanamanId) {
      lahan.penanaman_aktif.kejadian.push(kejadian);
    } else {
      const p = lahan.riwayat_penanaman.find(item => item.id === penanamanId);
      if (p) {
        p.kejadian.push(kejadian);
      }
    }
    this.saveStore(store);
  }
}
