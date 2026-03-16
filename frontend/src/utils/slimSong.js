/**
 * Slim down song objects to only keep fields needed by the UI.
 * A full NeteaseCloudMusic song object is ~3-5KB; a slimmed one is ~0.2-0.3KB.
 *
 * Kept fields:
 *  - id, name, dt (duration)
 *  - ar: [{ id, name }]          – artist list
 *  - al: { id, name, picUrl }    – album info + cover
 *  - fee                          – 0=free, 1=VIP (used for VIP badge)
 *  - noCopyrightRcmd              – null = playable (used for greying out)
 *  - mv                           – MV id (used for MV button)
 */

export function slimSong(song) {
  if (!song) return song
  // Normalize: FM API uses `album`/`artists`, standard uses `al`/`ar`
  const al = song.al || song.album
  const ar = song.ar || song.artists
  return {
    id: song.id,
    name: song.name,
    dt: song.dt || song.duration,
    ar: ar?.map(a => ({ id: a.id, name: a.name })) || [],
    al: al ? { id: al.id, name: al.name, picUrl: al.picUrl || al.pic_str || al.pic || song.picUrl || song.coverUrl || '' } : null,
    fee: song.fee,
    noCopyrightRcmd: song.noCopyrightRcmd ?? null,
    mv: song.mv || 0,
  }
}

export function slimSongs(songs) {
  if (!Array.isArray(songs)) return songs
  return songs.map(slimSong)
}
