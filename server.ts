import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type {
  ContactUnlockRequest,
  MatrimonyProfile,
  RishtaProposal,
} from './src/types/matrimony.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'bureau-store.json');
const PORT = Number(process.env.PORT) || 3000;

interface BureauStore {
  userProfiles: MatrimonyProfile[];
  unlockRequests: ContactUnlockRequest[];
  proposals: RishtaProposal[];
}

function ensureStoreFile(): BureauStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: BureauStore = {
      userProfiles: [],
      unlockRequests: [],
      proposals: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BureauStore>;
    return {
      userProfiles: Array.isArray(parsed.userProfiles) ? parsed.userProfiles : [],
      unlockRequests: Array.isArray(parsed.unlockRequests)
        ? parsed.unlockRequests
        : [],
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
    };
  } catch {
    return { userProfiles: [], unlockRequests: [], proposals: [] };
  }
}

function writeStore(store: BureauStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/bureau/state', (_req, res) => {
    const store = ensureStoreFile();
    res.json(store);
  });

  app.post('/api/bureau/profiles', (req, res) => {
    const store = ensureStoreFile();
    const payload = req.body as Partial<MatrimonyProfile>;

    if (!payload.fullName || !payload.education || !payload.profession) {
      res.status(400).json({ error: 'Missing required profile fields.' });
      return;
    }

    const maxNum = store.userProfiles.reduce((max, p) => {
      const match = /^SM-2026-(\d+)$/.exec(p.referenceCode || '');
      const val = match ? Number(match[1]) : 200;
      return val > max ? val : max;
    }, 200);
    const num = maxNum + 1;
    const newProfile: MatrimonyProfile = {
      id: `user-prof-${Date.now()}`,
      referenceCode: `SM-2026-${num}`,
      fullName: String(payload.fullName).trim(),
      gender: payload.gender === 'groom' ? 'groom' : 'bride',
      age: Number(payload.age) || 25,
      height: String(payload.height || '5\'6"').trim(),
      maritalStatus: payload.maritalStatus || 'Never Married',
      city: String(payload.city || 'Lahore').trim(),
      country: String(payload.country || 'Pakistan').trim(),
      education: String(payload.education).trim(),
      institution: String(payload.institution || 'Recognized University').trim(),
      profession: String(payload.profession).trim(),
      incomeBracket: payload.incomeBracket
        ? String(payload.incomeBracket).trim()
        : undefined,
      religionSect: String(payload.religionSect || 'Islam · Sunni').trim(),
      communityCaste: payload.communityCaste
        ? String(payload.communityCaste).trim()
        : undefined,
      fatherOccupation: String(
        payload.fatherOccupation || 'Private Sector'
      ).trim(),
      motherOccupation: String(payload.motherOccupation || 'Homemaker').trim(),
      siblingsSummary: String(
        payload.siblingsSummary || 'Details shared on call'
      ).trim(),
      residenceStatus: payload.residenceStatus || 'Own Family Home',
      aboutSelf: String(
        payload.aboutSelf ||
          'Respectable, family-oriented candidate seeking a compatible life partner.'
      ).trim(),
      partnerExpectations: String(
        payload.partnerExpectations ||
          'Looking for an educated, sincere match from a respectful family.'
      ).trim(),
      createdBy: payload.createdBy || 'Self',
      photoVisibility:
        payload.photoVisibility === 'on_request' ? 'on_request' : 'public',
      photoUrl: payload.photoUrl ? String(payload.photoUrl) : undefined,
      contactGuardianName: String(payload.contactGuardianName || '').trim(),
      contactPhone: String(payload.contactPhone || '').trim(),
      verificationStatus: 'pending_payment',
      isUserCreated: true,
      createdAt: new Date().toISOString(),
    };

    store.userProfiles = [newProfile, ...store.userProfiles];
    writeStore(store);
    res.status(201).json({ profile: newProfile });
  });

  app.put('/api/bureau/profiles/:id', (req, res) => {
    const store = ensureStoreFile();
    const { id } = req.params;
    const payload = req.body as Partial<MatrimonyProfile>;
    const existingIndex = store.userProfiles.findIndex((p) => p.id === id);

    if (existingIndex === -1) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const existing = store.userProfiles[existingIndex];
    const updated: MatrimonyProfile = {
      ...existing,
      ...payload,
      id: existing.id,
      referenceCode: existing.referenceCode,
      createdAt: existing.createdAt,
      verificationStatus: existing.verificationStatus,
      isUserCreated: true,
    };

    store.userProfiles[existingIndex] = updated;
    writeStore(store);
    res.json({ profile: updated });
  });

  app.patch('/api/bureau/profiles/:id/status', (req, res) => {
    const store = ensureStoreFile();
    const { id } = req.params;
    const { status } = req.body as {
      status?: MatrimonyProfile['verificationStatus'];
    };

    if (
      status !== 'verified' &&
      status !== 'pending_payment' &&
      status !== 'rejected'
    ) {
      res.status(400).json({ error: 'Invalid verification status.' });
      return;
    }

    const existingIndex = store.userProfiles.findIndex((p) => p.id === id);
    if (existingIndex === -1) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    store.userProfiles[existingIndex] = {
      ...store.userProfiles[existingIndex],
      verificationStatus: status,
    };
    writeStore(store);
    res.json({ profile: store.userProfiles[existingIndex] });
  });

  app.delete('/api/bureau/profiles/:id', (req, res) => {
    const store = ensureStoreFile();
    const { id } = req.params;
    store.userProfiles = store.userProfiles.filter((p) => p.id !== id);
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/bureau/unlocks', (req, res) => {
    const store = ensureStoreFile();
    const payload = req.body as Partial<ContactUnlockRequest>;

    if (
      !payload.targetProfileId ||
      !payload.requesterName ||
      !payload.requesterPhone
    ) {
      res.status(400).json({ error: 'Missing required unlock request fields.' });
      return;
    }

    const newRequest: ContactUnlockRequest = {
      id: `unlock-${Date.now()}`,
      targetProfileId: String(payload.targetProfileId),
      targetName: String(payload.targetName || ''),
      targetReferenceCode: String(payload.targetReferenceCode || ''),
      requesterName: String(payload.requesterName).trim(),
      requesterPhone: String(payload.requesterPhone).trim(),
      feePkr: 100,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    store.unlockRequests = [
      newRequest,
      ...store.unlockRequests.filter(
        (r) =>
          !(
            r.targetProfileId === newRequest.targetProfileId &&
            r.requesterPhone === newRequest.requesterPhone
          )
      ),
    ];
    writeStore(store);
    res.status(201).json({ request: newRequest });
  });

  app.patch('/api/bureau/unlocks/:id/status', (req, res) => {
    const store = ensureStoreFile();
    const { id } = req.params;
    const { status } = req.body as {
      status?: ContactUnlockRequest['status'];
    };

    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      res.status(400).json({ error: 'Invalid unlock status.' });
      return;
    }

    const index = store.unlockRequests.findIndex((r) => r.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Unlock request not found.' });
      return;
    }

    store.unlockRequests[index] = {
      ...store.unlockRequests[index],
      status,
      approvedAt:
        status === 'approved' ? new Date().toISOString() : undefined,
    };
    writeStore(store);
    res.json({ request: store.unlockRequests[index] });
  });

  app.post('/api/bureau/proposals', (req, res) => {
    const store = ensureStoreFile();
    const payload = req.body as Partial<RishtaProposal>;

    if (!payload.targetProfileId || !payload.senderName || !payload.message) {
      res.status(400).json({ error: 'Missing proposal details.' });
      return;
    }

    const newProposal: RishtaProposal = {
      id: `prop-${Date.now()}`,
      targetProfileId: String(payload.targetProfileId),
      targetName: String(payload.targetName || ''),
      targetReferenceCode: String(payload.targetReferenceCode || ''),
      senderName: String(payload.senderName).trim(),
      senderRelation: payload.senderRelation || 'Parents',
      senderCity: String(payload.senderCity || '').trim(),
      senderContact: String(payload.senderContact || '').trim(),
      message: String(payload.message).trim(),
      sentAt: new Date().toISOString(),
    };

    store.proposals = [newProposal, ...store.proposals];
    writeStore(store);
    res.status(201).json({ proposal: newProposal });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sukoon Matrimony server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
