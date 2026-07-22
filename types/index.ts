// ─── Auth ────────────────────────────────────────────────────────────────────
export type Role = 'gerant' | 'superviseur' | 'admin'

export interface User {
  id: number
  nom: string
  role: Role
  login: string
}

export interface LoginResponse {
  user: User
  settings: {
    currency_code: 'XAF' | 'XOF'
    currency_label: 'FCFA'
    nom_provenderie: string
  }
}

// ─── Matière Première ─────────────────────────────────────────────────────────
export interface MatierePremiere {
  id: number
  nom: string
  quantite: number
  prix_achat_moyen: number
  prix_kg: number
  prix_vente: number
  seuil_alerte: number
  unite?: string
  actif: boolean
}

export interface Accessoire {
  id: number
  nom: string
  description: string
  unite: string
  photo?: string | null
  photo_url?: string | null
  prix_achat: number
  prix_vente: number
  stock_disponible: number
  seuil_alerte: number
  actif: boolean
}

// ─── Lot Fournisseur ──────────────────────────────────────────────────────────
export interface LotFournisseur {
  id: number
  matiere_premiere_id: number
  matiere_premiere?: MatierePremiere
  mp_nom?: string
  quantite_initiale: number
  quantite_restante: number
  cout_kg: number
  prix_achat: number
  numero_lot: string
  fournisseur: string
  date_reception: string
  date_peremption?: string | null
  statut: string
}

// ─── Formule ──────────────────────────────────────────────────────────────────
export interface Formule {
  id: number
  nom: string
  code: string
  /** Coût de revient (FCFA/kg), calculé à partir de la composition */
  prix_unitaire?: number
  stade_vie_nom?: string | null
  compositions?: CompositionFormule[]
}

export interface CompositionFormule {
  id: number
  formule_id: number
  matiere_premiere_id: number
  matiere_premiere?: MatierePremiere
  mp_nom?: string
  pourcentage: number
}

// ─── Production ───────────────────────────────────────────────────────────────
export interface Production {
  id: number
  formule: number
  formule_nom: string
  formule_code: string
  quantite: number
  date: string
  date_production?: string
  statut: string
  lot_pf: number
  lot_pf_detail?: LotPF
  consommations_lots?: {
    lot_fournisseur_id: number
    numero_lot: string
    matiere_premiere: string
    quantite: number
    cout_unitaire: number
  }[]
}

export interface LotPF {
  id: number
  production_id?: number
  quantite_initiale: number
  quantite_restante: number
  cout_revient: number
  date_creation: string
  numero_lot?: string
  formule_nom?: string
  statut?: string
  date_peremption?: string
  formule?: Formule
}

// ─── Client ───────────────────────────────────────────────────────────────────
export interface Client {
  id: number
  nom: string
  contact: string
  adresse: string
  annees_elevage: number
  animaux_eleves: string
}

// ─── Commande / Vente ─────────────────────────────────────────────────────────
export type ModePaiement = 'cash' | 'credit'
export type StatutPaiement = 'non_paye' | 'partiel' | 'paye'
export type TypeProduit = 'pf' | 'mp' | 'accessoire'

export interface Commande {
  id: number
  client: number
  client_nom: string
  type_produit: TypeProduit
  produit_nom: string
  unite: string
  lot_pf: number | null
  lot_pf_numero?: string | null
  matiere_premiere_id?: number | null
  accessoire_id?: number | null
  numero_commande: string
  quantite: number
  prix_unitaire: number
  cout_unitaire: number
  montant: number
  montant_total: number
  montant_paye: number
  reste_a_payer: number
  date_commande: string
  statut: string
  mode_paiement: ModePaiement
  statut_paiement: StatutPaiement
  marge: number
  paiements?: { id: number; montant: number; created_at: string }[]
}

// ─── Inventaire ───────────────────────────────────────────────────────────────
export interface StockMP {
  matiere_premiere: MatierePremiere
  quantite_totale: number
  lots: LotFournisseur[]
}

export interface StockPF {
  lot_pf: LotPF
  quantite_restante: number
}

export interface StockResponse {
  matieres_premieres: StockMP[]
  produits_finis: StockPF[]
  accessoires: Accessoire[]
}

export interface AjustementStock {
  matiere_premiere_id?: number
  lot_pf_id?: number
  accessoire_id?: number
  quantite: number
  justification: string
}

// ─── Rapports ─────────────────────────────────────────────────────────────────
export interface RapportJournalier {
  date: string
  synthese_stock: Record<string, number>
  synthese_caisse: {
    total_ventes: number
    cash: number
    credit: number
    partiel: number
  }
}

// ─── Utilisateur ──────────────────────────────────────────────────────────────
export interface Utilisateur {
  id: number
  nom: string
  login: string
  role: Role
  is_active: boolean
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  error: string
  code: string
}
