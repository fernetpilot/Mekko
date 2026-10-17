// Alle bilmodellene i 3D-scenen. Navnet velges av velgBilmodell i /js/bilmodell.js.
// Discovery 3 er den ferdige Meshy-modellen. Den kodebygde utgaven kan vises med ?bilmodell=discovery3kode.
import { standard } from './standard.js';
import { discovery3 as discovery3Kode, discovery4 } from './discovery.js';
import { discovery3Meshy } from './discovery-meshy.js';

export const MODELLER = { standard, discovery3: discovery3Meshy, discovery3kode: discovery3Kode, discovery4 };
