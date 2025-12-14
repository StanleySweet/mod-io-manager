import { getDB } from '../database/db.js';
import cron from 'node-cron';

interface ModioMod {
  id: number;
  name: string;
  profile_url: string;
  status: number;
  date_added: number;
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
          
          // Log deletion summary
          logger.info(`Deleted ${modsToDelete.length} mod(s) no longer on mod.io`);
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
        
        // Sort by date_added descending (latest first) - only if there are files
        if (modFiles.length > 0) {
          modFiles.sort((a, b) => b.date_added - a.date_added);
        }
        
        // Determine active/current file from mod.io: prefer detailed mod info; fallback to list's modfile
        let activeFileId = (modioMod as any)?.modfile?.id ?? null;
        if (!activeFileId && modFiles.length > 0) {
          const modDetails = await fetchModDetails(modioMod.id);
          activeFileId = (modDetails as any)?.modfile?.id ?? null;
        }

        await db.transaction(async (trx) => {
          // Check if mod exists in database
          let existingMod = await trx('mods').where({ mod_io_id: modioMod.id }).first();

          // If mod doesn't exist, create it
          if (!existingMod) {
            // Use latest file's upload date if available, otherwise use mod's creation date
            const uploadedAt = modFiles.length > 0 
              ? new Date(modFiles[0].date_added * 1000)
              : new Date(modioMod.date_added * 1000);

            const [modId] = await trx('mods').insert({
              mod_io_id: modioMod.id,
              name: modioMod.name,
              last_uploaded_at: uploadedAt,
              mod_io_url: modioMod.profile_url,
              status: modioMod.status,
            });

            existingMod = { id: modId, mod_io_id: modioMod.id, name: modioMod.name };
            const versionCount = modFiles.length > 0 ? modFiles.length : 0;
            logger.info(`New mod added: ${modioMod.name} (ID: ${modioMod.id}) with ${versionCount} version${versionCount !== 1 ? 's' : ''}`);
          } else {
            // Update mod metadata
            const uploadedAt = modFiles.length > 0 
              ? new Date(modFiles[0].date_added * 1000)
              : existingMod.last_uploaded_at;
            
            await trx('mods').where({ id: existingMod.id }).update({
              last_uploaded_at: uploadedAt,
              name: modioMod.name,
              status: modioMod.status,
            });
          }

          // Get existing versions from database
          const existingVersions = await trx('mod_versions')
            .where({ mod_id: existingMod.id })
            .select('id', 'mod_io_file_id', 'version', 'md5', 'is_signed', 'is_current');

          const existingFileIdMap = new Map(existingVersions.map(v => [v.mod_io_file_id, v]));
          const modIoFileIds = new Set(modFiles.map(f => f.id));

          // Delete versions that no longer exist on mod.io (including when mod now has 0 files)
          let deletedVersionCount = 0;
          for (const existingVersion of existingVersions) {
            if (!modIoFileIds.has(existingVersion.mod_io_file_id)) {
              await trx('mod_versions').where({ id: existingVersion.id }).del();
              deletedVersionCount++;
            }
          }

          // Only process file versions if mod has files
          let newVersionCount = 0;
          let updatedVersionCount = 0;

          if (modFiles.length > 0) {
            // Reset all versions to is_current: false once before processing
            // This avoids doing it multiple times in the loop
            await trx('mod_versions')
              .where({ mod_id: existingMod.id })
              .update({ is_current: false });

            // Process each modfile from mod.io
            for (let i = 0; i < modFiles.length; i++) {
              const modFile = modFiles[i];
              const isLatest = i === 0; // First file is the latest (sorted by date DESC)
              const isCurrent = activeFileId ? modFile.id === activeFileId : isLatest;

              const version = modFile.version || modFile.filename?.replace(/\.zip$/i, '') || `v${modFile.id}`;
              const uploadedAt = new Date(modFile.date_added * 1000);
              const md5 = modFile.filehash?.md5 || '';
              const isSigned = isModSigned(modFile.metadata_blob);

              const existingVersion = existingFileIdMap.get(modFile.id);

              if (existingVersion) {
                // Only update if something actually changed
                const needsUpdate = 
                  existingVersion.is_signed !== isSigned ||
                  existingVersion.is_current !== isCurrent ||
                  existingVersion.md5 !== md5;
                
                if (needsUpdate) {
                  await trx('mod_versions')
                    .where({ id: existingVersion.id })
                    .update({
                      is_signed: isSigned,
                      is_current: isCurrent,
                      md5: md5,
                      checksum_hash: md5,
                    });
                  
                  if (existingVersion.is_signed !== isSigned) {
                    updatedVersionCount++;
                  }
                }
              } else {
                // Insert new version
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
            }
          }

          const details = [];
          if (newVersionCount > 0) {
            details.push(`${newVersionCount} new version${newVersionCount !== 1 ? 's' : ''}`);
          }
          if (updatedVersionCount > 0) {
            details.push(`${updatedVersionCount} signature${updatedVersionCount !== 1 ? 's' : ''} updated`);
          }
          if (deletedVersionCount > 0) {
            details.push(`${deletedVersionCount} version${deletedVersionCount !== 1 ? 's' : ''} deleted`);
          }
          if (modFiles.length === 0 && deletedVersionCount === 0) {
            details.push('no files available (possible spam)');
          }

          // Only create audit log if there were actual changes
          if (details.length > 0) {
            await trx('audit_logs').insert({
              user_id: triggeredByUserId ?? null,
              action: 'MODIO_SYNC',
              resource: modioMod.id.toString(),
              details: `Synced mod: ${modioMod.name} (${details.join(', ')})`,
              user_agent: 'modio-sync-service',
            });
          }
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
