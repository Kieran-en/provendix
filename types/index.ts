// ─── Auth ────────────────────────────────────────────────────────────────────
export type Role = 'gerant' | 'superviseur'

export interface User {
  id: number
  nom: string
  role: Role
  login: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
}

export interface LoginResponse extends AuthTokens {
  user: User
}

// ─── Matière Première ─────────────────────────────────────────────────────────
export interface MatierePremiere {
  id: number
  nom: string
  quantite: number
  prix_kg: number
}

// ─── Lot Fournisseur ──────────────────────────────────────────────────────────
export interface LotFournisseur {
  id: number
  matiere_premiere_id: number
  matiere_premiere?: MatierePremiere
  quantite_initiale: number
  quantite_restante: number
  cout_kg: number
  date_reception: string
}

// ─── Formule ──────────────────────────────────────────────────────────────────
export interface Formule {
  id: number
  nom: string
  code: string
  compositions?: CompositionFormule[]
}

export interface CompositionFormule {
  id: number
  formule_id: number
  matiere_premiere_id: number
  matiere_premiere?: MatierePremiere
  quantite: number
  aliment_fourni: string
}

// ─── Production ───────────────────────────────────────────────────────────────
export interface Production {
  id: number
  formule_id: number
  formule?: Formule
  utilisateur_id: number
  utilisateur?: User
  date: string
  lot_pf?: LotPF
}

export interface LotPF {
  id: number
  production_id: number
  quantite_initiale: number
  quantite_restante: number
  cout_revient: number
  date_creation: string
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
export type StatutPaiement = 'cash' | 'credit' | 'partiel'

export interface Commande {
  id: number
  client_id: number
  client?: Client
  utilisateur_id: number
  utilisateur?: User
  date_heure: string
  montant: number
  statut_paiement: StatutPaiement
  lignes?: LigneCommande[]
}

export interface LigneCommande {
  id: number
  commande_id: number
  lot_pf_id: number
  lot_pf?: LotPF
  formule_id?: number
  formule?: Formule
  quantite: number
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

export interface AjustementStock {
  matiere_premiere_id?: number
  lot_pf_id?: number
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
