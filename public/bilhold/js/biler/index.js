// Alle bilmodellene i 3D-scenen. Navnet velges av velgBilmodell i /js/bilmodell.js.
// Discovery 3 er bygget i kode (samme stil som hengeren). Den ferdige Meshy-modellen kan vises med ?bilmodell=discovery3meshy.
import { standard } from './standard.js';
import { discovery3, discovery4 } from './discovery.js';
import { discovery3Meshy } from './discovery-meshy.js';

export const MODELLER = { standard, discovery3, discovery3meshy: discovery3Meshy, discovery4 };
