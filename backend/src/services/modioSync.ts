import { getDB } from '../database/db.js';
import cron from 'node-cron';

interface ModioMod {
  id: number;
  name: string;
  profile_url: string;
  status: number;
  modfile: {
    id: number;
    version: string;
    date_added: number;
    filesize: number;
    filename?: string;
    metadata_blob?: string;
    filehash: {
      md5: string;
    };
  };
}

interface ModioResponse {
  data: ModioMod[];
  result_offset: number;
  result_limit: number;
  result_total: number;
}

let isSyncing = false;

/**
 * Fetch detailed mod info to get the currently selected modfile (live version)
 */
async function fetchModDetails(modId: number): Promise<ModioMod | null> {
  const baseUrl = process.env.MODIO_BASE_URL || 'https://g-5.modapi.io/v1';
  const apiKey = process.env.MODIO_API_KEY;
  const oauthToken = process.env.MODIO_OAUTH_TOKEN;
  const gameId = process.env.MODIO_GAME_ID || '5';

  let url: string;
  const headers: Record<string, string> = {};

  if (oauthToken) {
    url = `${baseUrl}/games/${gameId}/mods/${modId}`;
    headers['Authorization'] = `Bearer ${oauthToken}`;
  } else {
    url = `${baseUrl}/games/${gameId}/mods/${modId}?api_key=${apiKey}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = (await response.json()) as ModioMod;
    return data || null;
  } catch {
    return null;
  }
}

/**
 * Fetch all modfiles for a specific mod ID
 */
async function fetchAllModFiles(modId: number) {
  const baseUrl = process.env.MODIO_BASE_URL || 'https://g-5.modapi.io/v1';
  const apiKey = process.env.MODIO_API_KEY;
  const oauthToken = process.env.MODIO_OAUTH_TOKEN;
  const gameId = process.env.MODIO_GAME_ID || '5';

  const allFiles: any[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    let url: string;
    const headers: Record<string, string> = {};

    if (oauthToken) {
      url = `${baseUrl}/games/${gameId}/mods/${modId}/files?_limit=${limit}&_offset=${offset}&_sort=-date_added`;
      headers['Authorization'] = `Bearer ${oauthToken}`;
    } else {
      url = `${baseUrl}/games/${gameId}/mods/${modId}/files?api_key=${apiKey}&_limit=${limit}&_offset=${offset}&_sort=-date_added`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return allFiles;
      }

      const data = (await response.json()) as { data: any[]; result_count: number; result_total: number };
      allFiles.push(...data.data);
      
      hasMore = data.data.length === limit && allFiles.length < data.result_total;
      offset += limit;
    } catch {
      return allFiles;
    }
  }

  return allFiles;
}

/**
 * Check if a mod version is signed by verifying minisigs in metadata_blob
 */
function isModSigned(metadataBlob?: string): boolean {
  if (!metadataBlob) return false;
  
  try {
    const metadata = JSON.parse(metadataBlob);
    return Array.isArray(metadata.minisigs) && metadata.minisigs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fetch all mods from mod.io API with pagination
 * Uses OAuth token if available for access to all mod statuses
 */
async function fetchModsFromModio(): Promise<ModioMod[]> {
  const baseUrl = process.env.MODIO_BASE_URL || 'https://g-5.modapi.io/v1';
  const apiKey = process.env.MODIO_API_KEY;
  const oauthToken = process.env.MODIO_OAUTH_TOKEN;
  const gameId = process.env.MODIO_GAME_ID || '5';
  const limit = 100;

  if (!apiKey && !oauthToken) {
    throw new Error('MODIO_API_KEY or MODIO_OAUTH_TOKEN must be configured');
  }

  const allMods: ModioMod[] = [];
  
  // Valid mod status values from mod.io API:
  // 0 = Not Accepted (Pending approval)
  // 1 = Accepted (Live)
  // 3 = Deleted (Archived)
  // Note: Status 2 does not exist for mods (returns 422 error)
  // OAuth token is required for statuses 0 and 3
  const statuses = [0, 1, 3];
  
  for (const status of statuses) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Build URL with authentication
      let url: string;
      const headers: Record<string, string> = {};
      
      if (oauthToken) {
        // OAuth authentication (access to all statuses)
        url = `${baseUrl}/games/${gameId}/mods?_limit=${limit}&_offset=${offset}&status=${status}`;
        headers['Authorization'] = `Bearer ${oauthToken}`;
      } else {
        // API key authentication (only status=1 accessible)
        url = `${baseUrl}/games/${gameId}/mods?api_key=${apiKey}&_limit=${limit}&_offset=${offset}&status=${status}`;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { 
          signal: controller.signal,
          headers 
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          // 403 Forbidden means we don't have access to this status level
          if (response.status === 403) {
            console.warn(`No access to mods with status=${status} (requires OAuth token)`);
            break;
          }
          throw new Error(`mod.io API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as ModioResponse;
        
        // Log successful fetch
        if (data.data.length > 0) {
          console.log(`Fetched ${data.data.length} mods with status=${status}`);
        }
        
        allMods.push(...data.data);

        hasMore = data.result_offset + data.result_limit < data.result_total;
        offset += limit;
      } catch (error) {
        // If we get an error with 403, skip this status (no access)
        if (error instanceof Error && error.message.includes('403')) {
          break;
        }
        // Otherwise throw the error
        throw new Error(`Failed to fetch mods from mod.io: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return allMods;
}

/**
 * Sync mods from mod.io into local database
 * Detects new/updated mods and stores via transactions
 */
export async function syncModsFromModio(logger: any, triggeredByUserId?: number): Promise<void> {
  if (isSyncing) {
    logger.warn('Mod.io sync already in progress, skipping');
    return;
  }

  isSyncing = true;

  try {
    const db = getDB();
    logger.info('Starting mod.io sync');

    const modsFromModio = await fetchModsFromModio();
    logger.info(`Fetched ${modsFromModio.length} mods from mod.io`);

    // Delete mods that no longer exist on mod.io (were deleted)
    const modIoIds = modsFromModio.map(m => m.id);
    
    if (modIoIds.length > 0) {
      // Get mods to delete before deleting them (for audit log)
      const modsToDelete = await db('mods')
        .whereNotIn('mod_io_id', modIoIds)
        .select('id', 'mod_io_id', 'name');
      
      if (modsToDelete.length > 0) {
        await db.transaction(async (trx) => {
          const idsToDelete = modsToDelete.map(m => m.id);
          
          // Delete associated versions first (foreign key constraint)
          await trx('mod_versions').whereIn('mod_id', idsToDelete).del();
          
          // Delete the mods
          await trx('mods').whereIn('id', idsToDelete).del();
          
          // Log each deletion
          for (const mod of modsToDelete) {
            logger.info(`Deleted mod: ${mod.name} (mod_io_id: ${mod.mod_io_id}) - no longer exists on mod.io`);
            
            await trx('audit_logs').insert({
              user_id: triggeredByUserId ?? null,
              action: 'MODIO_SYNC',
              resource: mod.mod_io_id.toString(),
              details: `Deleted mod: ${mod.name} (mod_io_id: ${mod.mod_io_id}) - removed from mod.io`,
              user_agent: 'modio-sync-service',
            });
          }
        });
      }
    }

    for (const modioMod of modsFromModio) {
      try {
        // Start with the modfile from the mod list if available
        let modFiles: any[] = [];
        
        if (modioMod.modfile && modioMod.modfile.version) {
          // Mod list already includes latest modfile
          modFiles.push(modioMod.modfile);
        }
        
        // Fetch ALL modfiles for this mod to get version history
        const additionalFiles = await fetchAllModFiles(modioMod.id);
        
        // Merge modfiles, avoiding duplicates by file ID
        const existingFileIds = new Set(modFiles.map(f => f.id));
        for (const file of additionalFiles) {
          if (!existingFileIds.has(file.id)) {
            modFiles.push(file);
          }
        }
        
        if (modFiles.length === 0) {
          logger.warn(`Skipping mod ${modioMod.name} (ID: ${modioMod.id}) - no files available`);
          continue;
        }

        // Sort by date_added descending (latest first)
        modFiles.sort((a, b) => b.date_added - a.date_added);
        
        // Determine active/current file from mod.io: prefer detailed mod info; fallback to list's modfile
        let activeFileId = (modioMod as any)?.modfile?.id ?? null;
        if (!activeFileId) {
          const modDetails = await fetchModDetails(modioMod.id);
          activeFileId = (modDetails as any)?.modfile?.id ?? null;
        }

        await db.transaction(async (trx) => {
          // Check if mod exists in database
          let existingMod = await trx('mods').where({ mod_io_id: modioMod.id }).first();

          // If mod doesn't exist, create it
          if (!existingMod) {
            const latestFile = modFiles[0]; // Files are sorted by date_added DESC
            const uploadedAt = new Date(latestFile.date_added * 1000);

            const [modId] = await trx('mods').insert({
              mod_io_id: modioMod.id,
              name: modioMod.name,
              last_uploaded_at: uploadedAt,
              mod_io_url: modioMod.profile_url,
              status: modioMod.status,
            });

            existingMod = { id: modId, mod_io_id: modioMod.id, name: modioMod.name };
            logger.info(`New mod added: ${modioMod.name} (ID: ${modioMod.id}) with ${modFiles.length} versions`);
          } else {
            // Update mod metadata
            const latestFile = modFiles[0];
            const uploadedAt = new Date(latestFile.date_added * 1000);
            
            await trx('mods').where({ id: existingMod.id }).update({
              last_uploaded_at: uploadedAt,
              name: modioMod.name,
              status: modioMod.status,
            });
          }

          // Get existing versions from database
          const existingVersions = await trx('mod_versions')
            .where({ mod_id: existingMod.id })
            .select('mod_io_file_id', 'version', 'md5');

          const existingFileIds = new Set(existingVersions.map(v => v.mod_io_file_id));

          // Process each modfile from mod.io
          let newVersionCount = 0;
          for (let i = 0; i < modFiles.length; i++) {
            const modFile = modFiles[i];
            const isLatest = i === 0; // First file is the latest (sorted by date DESC)
            const isCurrent = activeFileId ? modFile.id === activeFileId : isLatest;

            // Skip if we already have this file
            if (existingFileIds.has(modFile.id)) {
              continue;
            }

            const version = modFile.version || modFile.filename?.replace(/\.zip$/i, '') || `v${modFile.id}`;
            const uploadedAt = new Date(modFile.date_added * 1000);
            const md5 = modFile.filehash?.md5 || '';
            const isSigned = isModSigned(modFile.metadata_blob);

            // If this file should be marked current, mark all others as not current
            if (isCurrent) {
              await trx('mod_versions')
                .where({ mod_id: existingMod.id })
                .update({ is_current: false });
            }

            await trx('mod_versions').insert({
              mod_id: existingMod.id,
              mod_io_file_id: modFile.id,
              version: version,
              is_signed: isSigned,
              uploaded_at: uploadedAt,
              is_current: isCurrent,
              md5: md5,
              filesize: modFile.filesize || 0,
              checksum_hash: md5,
            });

            newVersionCount++;
          }

          if (newVersionCount > 0) {
            logger.info(`Added ${newVersionCount} new version(s) for ${modioMod.name}`);
          }

          await trx('audit_logs').insert({
            user_id: triggeredByUserId ?? null,
            action: 'MODIO_SYNC',
            resource: modioMod.id.toString(),
            details: `Synced mod: ${modioMod.name} (${newVersionCount} new version${newVersionCount !== 1 ? 's' : ''})`,
            user_agent: 'modio-sync-service',
          });
        });
      } catch (error) {
        logger.error(
          { err: error },
          `Error processing mod ${modioMod.name} (ID: ${modioMod.id}): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    logger.info('Mod.io sync completed successfully');
  } catch (error) {
    logger.error({ err: error }, `Mod.io sync failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isSyncing = false;
  }
}

/**
 * Start the mod.io polling scheduler
 */
export function startModioScheduler(logger: any): void {
  cron.schedule('0 */30 * * * *', () => {
    syncModsFromModio(logger).catch((err) => {
      logger.error({ err }, 'Uncaught error in modio scheduler');
    });
  });

  logger.info('Mod.io sync scheduler started (every 30 minutes)');

  setTimeout(() => {
    syncModsFromModio(logger).catch((err) => {
      logger.error({ err }, 'Uncaught error in initial modio sync');
    });
  }, 5000);
}
