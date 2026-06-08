const supabase = require("../config/supabase");
const AppError = require("../utils/appError");

const BRANCH_COLUMNS =
  "id, project_id, name, head_commit_id, is_default, created_by, created_at, updated_at";
const COMMIT_COLUMNS =
  "id, project_id, branch_id, parent_commit_id, merge_parent_commit_id, message, author_user_id, created_at";
const SCORE_VERSION_COLUMNS =
  "id, commit_id, score_id, storage_bucket, storage_path, file_type, original_filename, mime_type, file_size_bytes, created_at";
const SCORE_COLUMNS_FOR_VALIDATION = "id, project_id, section_id";

const ensureSupabaseReady = () => {
  if (!supabase) {
    throw new AppError("Supabase is not configured", 500);
  }
};

const isAdminRole = (role) => role === "platform_admin" || role === "concertmaster";

const canCommit = (membership) => {
  if (!membership) return false;
  return (
    membership.role === "platform_admin" ||
    membership.role === "concertmaster" ||
    membership.role === "principal"
  );
};

const assertCanCommit = (membership) => {
  if (!canCommit(membership)) {
    throw new AppError(
      "Forbidden: only concertmaster, principal, or platform_admin can create commits",
      403,
    );
  }
};

const assertConcertmaster = (membership, action) => {
  if (!membership || !isAdminRole(membership.role)) {
    throw new AppError(
      `Forbidden: only concertmaster or platform_admin can ${action}`,
      403,
    );
  }
};

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

const listBranches = async (projectId) => {
  ensureSupabaseReady();

  const { data, error } = await supabase
    .from("branches")
    .select(BRANCH_COLUMNS)
    .eq("project_id", projectId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    const code = error.code || "";
    const msg = String(error.message || "");
    // Unmigrated DB: history tables missing — treat as empty branch list so projects still open.
    if (
      code === "42P01" ||
      code === "PGRST205" ||
      /relation.*branches.*does not exist/i.test(msg) ||
      /Could not find the table.*branches/i.test(msg)
    ) {
      return [];
    }
    throw new AppError("Failed to fetch branches", 500, error);
  }

  return data || [];
};

const getBranchById = async (projectId, branchId) => {
  ensureSupabaseReady();

  const { data, error } = await supabase
    .from("branches")
    .select(BRANCH_COLUMNS)
    .eq("project_id", projectId)
    .eq("id", branchId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to fetch branch", 500, error);
  }
  if (!data) {
    throw new AppError("Branch not found", 404);
  }

  return data;
};

const createBranch = async ({ name, fromCommitId }, projectId, requestUser) => {
  ensureSupabaseReady();

  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    throw new AppError("name is required", 400);
  }

  let parentCommit = null;
  if (fromCommitId) {
    parentCommit = await loadCommitInProject(projectId, fromCommitId);
  }

  // First branch in the project becomes the default branch.
  const { count, error: countError } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (countError) {
    throw new AppError("Failed to count branches", 500, countError);
  }
  const isDefault = (count || 0) === 0;

  const { data: created, error: insertError } = await supabase
    .from("branches")
    .insert({
      project_id: projectId,
      name: normalizedName,
      head_commit_id: parentCommit ? parentCommit.id : null,
      is_default: isDefault,
      created_by: requestUser.id,
    })
    .select(BRANCH_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new AppError("Branch name already exists in this project", 409, insertError);
    }
    throw new AppError("Failed to create branch", 500, insertError);
  }

  return created;
};

const updateBranch = async ({ headCommitId, name }, projectId, branchId, membership) => {
  ensureSupabaseReady();
  assertConcertmaster(membership, "update branch");

  const branch = await getBranchById(projectId, branchId);

  const patch = {};
  if (headCommitId !== undefined) {
    if (headCommitId === null) {
      patch.head_commit_id = null;
    } else {
      const targetCommit = await loadCommitInProject(projectId, headCommitId);
      patch.head_commit_id = targetCommit.id;
    }
  }
  if (name !== undefined) {
    const normalized = String(name || "").trim();
    if (!normalized) {
      throw new AppError("name cannot be empty", 400);
    }
    patch.name = normalized;
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError("No updatable fields provided", 400);
  }

  const { data, error } = await supabase
    .from("branches")
    .update(patch)
    .eq("id", branch.id)
    .select(BRANCH_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError("Branch name already exists in this project", 409, error);
    }
    throw new AppError("Failed to update branch", 500, error);
  }

  return data;
};

const deleteBranch = async (projectId, branchId, membership) => {
  ensureSupabaseReady();
  assertConcertmaster(membership, "delete branch");

  const branch = await getBranchById(projectId, branchId);
  if (branch.is_default) {
    throw new AppError("Cannot delete the default branch", 400);
  }

  const { error } = await supabase.from("branches").delete().eq("id", branch.id);

  if (error) {
    throw new AppError("Failed to delete branch", 500, error);
  }

  return { id: branch.id };
};

// ---------------------------------------------------------------------------
// Commits
// ---------------------------------------------------------------------------

const loadCommitInProject = async (projectId, commitId) => {
  if (!commitId) {
    throw new AppError("commitId is required", 400);
  }

  const { data, error } = await supabase
    .from("commits")
    .select(COMMIT_COLUMNS)
    .eq("id", commitId)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to fetch commit", 500, error);
  }
  if (!data || data.project_id !== projectId) {
    throw new AppError("Commit not found in this project", 404);
  }

  return data;
};

const listCommitsForBranch = async (projectId, branchId) => {
  ensureSupabaseReady();

  // Verify branch belongs to project.
  await getBranchById(projectId, branchId);

  const { data, error } = await supabase
    .from("commits")
    .select(COMMIT_COLUMNS)
    .eq("project_id", projectId)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Failed to fetch commits", 500, error);
  }

  return data || [];
};

const loadScoreVersions = async (commitId) => {
  const { data, error } = await supabase
    .from("score_versions")
    .select(SCORE_VERSION_COLUMNS)
    .eq("commit_id", commitId);

  if (error) {
    throw new AppError("Failed to fetch score versions", 500, error);
  }

  return data || [];
};

const filterVisibleVersions = (versions, scoresMeta, membership) => {
  if (!membership || isAdminRole(membership.role)) {
    return versions;
  }
  // principal / member: only see versions for scores in their own section.
  const allowedScoreIds = new Set(
    scoresMeta
      .filter((s) => s.section_id === membership.section_id)
      .map((s) => s.id),
  );
  return versions.filter((v) => allowedScoreIds.has(v.score_id));
};

const getCommitDetail = async (projectId, commitId, membership) => {
  ensureSupabaseReady();
  const commit = await loadCommitInProject(projectId, commitId);
  const versions = await loadScoreVersions(commit.id);

  let visibleVersions = versions;
  if (membership && !isAdminRole(membership.role)) {
    const scoreIds = versions.map((v) => v.score_id);
    if (scoreIds.length === 0) {
      visibleVersions = [];
    } else {
      const { data: scoresMeta, error: scoresError } = await supabase
        .from("scores")
        .select(SCORE_COLUMNS_FOR_VALIDATION)
        .in("id", scoreIds);
      if (scoresError) {
        throw new AppError("Failed to fetch score metadata", 500, scoresError);
      }
      visibleVersions = filterVisibleVersions(versions, scoresMeta || [], membership);
    }
  }

  return {
    ...commit,
    score_versions: visibleVersions,
  };
};

const normalizeSnapshot = (snapshot) => {
  const scoreId = snapshot && snapshot.scoreId;
  const storageBucket = snapshot && (snapshot.storageBucket || "scores");
  const storagePath = snapshot && snapshot.storagePath;
  const fileType = snapshot && snapshot.fileType;
  if (!scoreId || !storagePath || !fileType) {
    throw new AppError(
      "Each scoreSnapshot must include scoreId, storagePath, and fileType",
      400,
    );
  }
  if (!["musicxml", "xml", "mxl"].includes(fileType)) {
    throw new AppError(
      `Invalid fileType '${fileType}'; expected one of musicxml, xml, mxl`,
      400,
    );
  }
  return {
    score_id: scoreId,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    file_type: fileType,
    original_filename: (snapshot && snapshot.originalFilename) || null,
    mime_type: (snapshot && snapshot.mimeType) || null,
    file_size_bytes:
      snapshot && typeof snapshot.fileSizeBytes === "number"
        ? snapshot.fileSizeBytes
        : null,
  };
};

const createCommit = async (
  { message, scoreSnapshots },
  projectId,
  branchId,
  requestUser,
  membership,
) => {
  ensureSupabaseReady();
  assertCanCommit(membership);

  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) {
    throw new AppError("message is required", 400);
  }
  if (!Array.isArray(scoreSnapshots) || scoreSnapshots.length === 0) {
    throw new AppError("scoreSnapshots must be a non-empty array", 400);
  }

  const branch = await getBranchById(projectId, branchId);
  const parentCommitId = branch.head_commit_id || null;

  // Normalize + validate snapshots.
  const normalizedSnapshots = scoreSnapshots.map(normalizeSnapshot);
  const snapshotScoreIds = normalizedSnapshots.map((s) => s.score_id);
  if (new Set(snapshotScoreIds).size !== snapshotScoreIds.length) {
    throw new AppError("scoreSnapshots contains duplicate scoreIds", 400);
  }

  // Ensure referenced scores belong to this project and (for principal) the section.
  const { data: referencedScores, error: scoresError } = await supabase
    .from("scores")
    .select(SCORE_COLUMNS_FOR_VALIDATION)
    .in("id", snapshotScoreIds);

  if (scoresError) {
    throw new AppError("Failed to validate scores", 500, scoresError);
  }

  const referencedById = new Map((referencedScores || []).map((s) => [s.id, s]));
  for (const id of snapshotScoreIds) {
    const score = referencedById.get(id);
    if (!score || score.project_id !== projectId) {
      throw new AppError(`Score ${id} not found in this project`, 400);
    }
    if (membership && membership.role === "principal") {
      if (score.section_id !== membership.section_id) {
        throw new AppError(
          `Forbidden: principal cannot commit changes for score ${id} outside their section`,
          403,
        );
      }
    }
  }

  // Insert commit.
  const { data: createdCommit, error: insertCommitError } = await supabase
    .from("commits")
    .insert({
      project_id: projectId,
      branch_id: branch.id,
      parent_commit_id: parentCommitId,
      merge_parent_commit_id: null,
      message: normalizedMessage,
      author_user_id: requestUser.id,
    })
    .select(COMMIT_COLUMNS)
    .single();

  if (insertCommitError) {
    throw new AppError("Failed to create commit", 500, insertCommitError);
  }

  // Build the full snapshot for this commit: parent snapshots + overrides from request.
  const inheritedById = new Map();
  if (parentCommitId) {
    const parentVersions = await loadScoreVersions(parentCommitId);
    for (const v of parentVersions) {
      inheritedById.set(v.score_id, {
        commit_id: createdCommit.id,
        score_id: v.score_id,
        storage_bucket: v.storage_bucket,
        storage_path: v.storage_path,
        file_type: v.file_type,
        original_filename: v.original_filename,
        mime_type: v.mime_type,
        file_size_bytes: v.file_size_bytes,
      });
    }
  }
  for (const snap of normalizedSnapshots) {
    inheritedById.set(snap.score_id, { ...snap, commit_id: createdCommit.id });
  }

  const versionRows = Array.from(inheritedById.values());
  if (versionRows.length > 0) {
    const { error: versionsError } = await supabase
      .from("score_versions")
      .insert(versionRows);

    if (versionsError) {
      // Roll back the commit so we don't leave an orphan.
      await supabase.from("commits").delete().eq("id", createdCommit.id);
      throw new AppError("Failed to record score versions", 500, versionsError);
    }
  }

  // Advance branch head.
  const { error: branchUpdateError } = await supabase
    .from("branches")
    .update({ head_commit_id: createdCommit.id })
    .eq("id", branch.id);

  if (branchUpdateError) {
    throw new AppError("Failed to advance branch head", 500, branchUpdateError);
  }

  return {
    ...createdCommit,
    score_versions: await loadScoreVersions(createdCommit.id),
  };
};

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

const buildVersionMap = (versions) => {
  const map = new Map();
  for (const v of versions) {
    map.set(v.score_id, v);
  }
  return map;
};

const compareCommits = async (projectId, fromCommitId, toCommitId, membership) => {
  ensureSupabaseReady();
  if (!fromCommitId || !toCommitId) {
    throw new AppError("from and to commit ids are required", 400);
  }

  const [fromCommit, toCommit] = await Promise.all([
    loadCommitInProject(projectId, fromCommitId),
    loadCommitInProject(projectId, toCommitId),
  ]);

  const [fromVersions, toVersions] = await Promise.all([
    loadScoreVersions(fromCommit.id),
    loadScoreVersions(toCommit.id),
  ]);

  // For principal/member, restrict to their own section.
  let allowedSectionId = null;
  if (membership && !isAdminRole(membership.role)) {
    allowedSectionId = membership.section_id;
  }

  const allScoreIds = Array.from(
    new Set([...fromVersions.map((v) => v.score_id), ...toVersions.map((v) => v.score_id)]),
  );

  let scoresMetaById = new Map();
  if (allScoreIds.length > 0) {
    const { data: scoresMeta, error: scoresError } = await supabase
      .from("scores")
      .select(SCORE_COLUMNS_FOR_VALIDATION)
      .in("id", allScoreIds);
    if (scoresError) {
      throw new AppError("Failed to fetch score metadata", 500, scoresError);
    }
    scoresMetaById = new Map((scoresMeta || []).map((s) => [s.id, s]));
  }

  const fromMap = buildVersionMap(fromVersions);
  const toMap = buildVersionMap(toVersions);

  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  for (const scoreId of allScoreIds) {
    const scoreMeta = scoresMetaById.get(scoreId);
    if (allowedSectionId && scoreMeta && scoreMeta.section_id !== allowedSectionId) {
      continue;
    }
    const fromVersion = fromMap.get(scoreId) || null;
    const toVersion = toMap.get(scoreId) || null;

    if (!fromVersion && toVersion) {
      added.push({ scoreId, from: null, to: toVersion });
    } else if (fromVersion && !toVersion) {
      removed.push({ scoreId, from: fromVersion, to: null });
    } else if (fromVersion && toVersion) {
      const samePath =
        fromVersion.storage_bucket === toVersion.storage_bucket &&
        fromVersion.storage_path === toVersion.storage_path;
      if (samePath) {
        unchanged.push({ scoreId, from: fromVersion, to: toVersion });
      } else {
        modified.push({ scoreId, from: fromVersion, to: toVersion });
      }
    }
  }

  return {
    from: fromCommit,
    to: toCommit,
    added,
    removed,
    modified,
    unchanged,
  };
};

// ---------------------------------------------------------------------------
// Merge base + conflict detection (3-way)
// ---------------------------------------------------------------------------

const fetchCommitRow = async (commitId) => {
  if (!commitId) return null;
  const { data, error } = await supabase
    .from("commits")
    .select(COMMIT_COLUMNS)
    .eq("id", commitId)
    .maybeSingle();
  if (error) {
    throw new AppError("Failed to walk commit history", 500, error);
  }
  return data || null;
};

// Collect every ancestor commit id reachable from `headCommitId` by following
// both parent_commit_id and merge_parent_commit_id (the merge commit's two
// parents). The head itself is included.
const collectAncestors = async (headCommitId) => {
  const seen = new Set();
  const stack = headCommitId ? [headCommitId] : [];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const commit = await fetchCommitRow(id);
    if (!commit) continue;
    if (commit.parent_commit_id) stack.push(commit.parent_commit_id);
    if (commit.merge_parent_commit_id) stack.push(commit.merge_parent_commit_id);
  }
  return seen;
};

// Nearest common ancestor of two heads (the merge base). Returns its commit id
// or null when the two histories share no ancestor (unrelated roots).
const findMergeBaseId = async (fromHeadId, intoHeadId) => {
  if (!fromHeadId || !intoHeadId) return null;
  const intoAncestors = await collectAncestors(intoHeadId);
  // Breadth-first from the source head so the FIRST hit is the nearest base.
  const seen = new Set();
  const queue = [fromHeadId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (intoAncestors.has(id)) return id;
    const commit = await fetchCommitRow(id);
    if (!commit) continue;
    if (commit.parent_commit_id) queue.push(commit.parent_commit_id);
    if (commit.merge_parent_commit_id) queue.push(commit.merge_parent_commit_id);
  }
  return null;
};

// Two score versions are "the same" when they point at the same stored file.
// null means the score is absent on that side.
const sameVersion = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.storage_bucket === b.storage_bucket && a.storage_path === b.storage_path;
};

// Build the per-score merge plan between two heads using their merge base.
// A score conflicts when BOTH sides changed it relative to the base AND the
// two changes differ. Scores changed on only one side auto-resolve.
const buildMergePlan = async (fromHeadId, intoHeadId) => {
  const baseId = await findMergeBaseId(fromHeadId, intoHeadId);
  const [baseVersions, ourVersions, theirVersions] = await Promise.all([
    baseId ? loadScoreVersions(baseId) : Promise.resolve([]),
    intoHeadId ? loadScoreVersions(intoHeadId) : Promise.resolve([]),
    fromHeadId ? loadScoreVersions(fromHeadId) : Promise.resolve([]),
  ]);

  const baseMap = buildVersionMap(baseVersions);
  const ourMap = buildVersionMap(ourVersions);
  const theirMap = buildVersionMap(theirVersions);

  const scoreIds = new Set([
    ...baseMap.keys(),
    ...ourMap.keys(),
    ...theirMap.keys(),
  ]);

  const conflicts = [];
  for (const scoreId of scoreIds) {
    const base = baseMap.get(scoreId) || null;
    const ours = ourMap.get(scoreId) || null;
    const theirs = theirMap.get(scoreId) || null;
    const ourChanged = !sameVersion(ours, base);
    const theirChanged = !sameVersion(theirs, base);
    if (ourChanged && theirChanged && !sameVersion(ours, theirs)) {
      conflicts.push({ scoreId, base, ours, theirs });
    }
  }

  return { baseId, baseMap, ourMap, theirMap, scoreIds, conflicts };
};

// Decide the winning version for one score given the 3-way state and an
// optional explicit resolution ("ours" | "theirs"). Unresolved conflicts fall
// back to legacy "theirs wins" so a no-resolution merge stays backward-compatible.
const pickMergedVersion = ({ base, ours, theirs, isConflict, resolution }) => {
  if (isConflict) {
    if (resolution === "ours") return ours;
    if (resolution === "theirs") return theirs;
    return theirs || ours; // legacy default: theirs wins
  }
  const ourChanged = !sameVersion(ours, base);
  const theirChanged = !sameVersion(theirs, base);
  if (theirChanged && !ourChanged) return theirs;
  if (ourChanged && !theirChanged) return ours;
  return ours || theirs; // both unchanged, or both changed identically
};

const normalizeResolutions = (resolutions) => {
  const map = new Map();
  if (Array.isArray(resolutions)) {
    for (const r of resolutions) {
      if (r && r.scoreId && (r.resolution === "ours" || r.resolution === "theirs")) {
        map.set(r.scoreId, r.resolution);
      }
    }
  }
  return map;
};

// Read-only merge preview: which scores conflict if `fromBranch` is merged into
// `intoBranch`. Same role gate as the merge itself (concertmaster / admin).
const previewMerge = async ({ fromBranchId, intoBranchId }, projectId, membership) => {
  ensureSupabaseReady();
  assertConcertmaster(membership, "preview merge");

  if (!fromBranchId || !intoBranchId) {
    throw new AppError("fromBranchId and intoBranchId are required", 400);
  }
  if (fromBranchId === intoBranchId) {
    throw new AppError("fromBranchId and intoBranchId must differ", 400);
  }

  const [fromBranch, intoBranch] = await Promise.all([
    getBranchById(projectId, fromBranchId),
    getBranchById(projectId, intoBranchId),
  ]);

  if (!fromBranch.head_commit_id) {
    throw new AppError("Source branch has no commits to merge", 400);
  }

  const plan = await buildMergePlan(
    fromBranch.head_commit_id,
    intoBranch.head_commit_id || null,
  );

  return {
    from_branch: fromBranch,
    into_branch: intoBranch,
    base_commit_id: plan.baseId,
    has_conflicts: plan.conflicts.length > 0,
    conflicts: plan.conflicts.map((c) => ({
      score_id: c.scoreId,
      base: c.base,
      ours: c.ours,
      theirs: c.theirs,
    })),
  };
};

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

const mergeBranches = async (
  { fromBranchId, intoBranchId, message, resolutions },
  projectId,
  requestUser,
  membership,
) => {
  ensureSupabaseReady();
  assertConcertmaster(membership, "merge branches");

  if (!fromBranchId || !intoBranchId) {
    throw new AppError("fromBranchId and intoBranchId are required", 400);
  }
  if (fromBranchId === intoBranchId) {
    throw new AppError("fromBranchId and intoBranchId must differ", 400);
  }

  const [fromBranch, intoBranch] = await Promise.all([
    getBranchById(projectId, fromBranchId),
    getBranchById(projectId, intoBranchId),
  ]);

  if (!fromBranch.head_commit_id) {
    throw new AppError("Source branch has no commits to merge", 400);
  }

  const fromHead = await loadCommitInProject(projectId, fromBranch.head_commit_id);
  const intoHead = intoBranch.head_commit_id
    ? await loadCommitInProject(projectId, intoBranch.head_commit_id)
    : null;

  // 3-way plan so we can auto-merge non-conflicting scores and honour explicit
  // resolutions for the conflicting ones.
  const plan = await buildMergePlan(fromHead.id, intoHead ? intoHead.id : null);
  const conflictIds = new Set(plan.conflicts.map((c) => c.scoreId));
  const resolutionMap = normalizeResolutions(resolutions);

  // When the caller supplies resolutions, treat the merge as conflict-aware:
  // every conflict must be resolved or we refuse (the 409 carries the conflict
  // list so a client can recover). With no resolutions we keep the legacy
  // "theirs wins" behaviour for backward compatibility.
  if (resolutionMap.size > 0) {
    const unresolved = plan.conflicts.filter((c) => !resolutionMap.has(c.scoreId));
    if (unresolved.length > 0) {
      throw new AppError("All merge conflicts must be resolved before merging", 409, {
        conflicts: plan.conflicts.map((c) => ({ score_id: c.scoreId })),
      });
    }
  }

  const mergeMessage =
    String(message || "").trim() ||
    `Merge branch '${fromBranch.name}' into '${intoBranch.name}'`;

  const { data: mergeCommit, error: insertError } = await supabase
    .from("commits")
    .insert({
      project_id: projectId,
      branch_id: intoBranch.id,
      parent_commit_id: intoHead ? intoHead.id : null,
      merge_parent_commit_id: fromHead.id,
      message: mergeMessage,
      author_user_id: requestUser.id,
    })
    .select(COMMIT_COLUMNS)
    .single();

  if (insertError) {
    throw new AppError("Failed to create merge commit", 500, insertError);
  }

  // Resolve score_versions via the 3-way plan: non-conflicting scores take the
  // side that changed; conflicting scores follow the explicit resolution (or
  // legacy "theirs wins" when none was given).
  const mergedById = new Map();
  for (const scoreId of plan.scoreIds) {
    const chosen = pickMergedVersion({
      base: plan.baseMap.get(scoreId) || null,
      ours: plan.ourMap.get(scoreId) || null,
      theirs: plan.theirMap.get(scoreId) || null,
      isConflict: conflictIds.has(scoreId),
      resolution: resolutionMap.get(scoreId),
    });
    if (chosen) mergedById.set(scoreId, chosen);
  }

  const versionRows = Array.from(mergedById.values()).map((v) => ({
    commit_id: mergeCommit.id,
    score_id: v.score_id,
    storage_bucket: v.storage_bucket,
    storage_path: v.storage_path,
    file_type: v.file_type,
    original_filename: v.original_filename,
    mime_type: v.mime_type,
    file_size_bytes: v.file_size_bytes,
  }));

  if (versionRows.length > 0) {
    const { error: versionsError } = await supabase
      .from("score_versions")
      .insert(versionRows);

    if (versionsError) {
      await supabase.from("commits").delete().eq("id", mergeCommit.id);
      throw new AppError("Failed to record merged score versions", 500, versionsError);
    }
  }

  const { error: advanceError } = await supabase
    .from("branches")
    .update({ head_commit_id: mergeCommit.id })
    .eq("id", intoBranch.id);

  if (advanceError) {
    throw new AppError("Failed to advance branch head after merge", 500, advanceError);
  }

  return {
    ...mergeCommit,
    score_versions: await loadScoreVersions(mergeCommit.id),
  };
};

module.exports = {
  // branches
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  // commits
  listCommitsForBranch,
  getCommitDetail,
  createCommit,
  // compare / merge
  compareCommits,
  previewMerge,
  mergeBranches,
  // pure helpers exported for unit-tests (no Supabase dependency)
  _helpers: {
    isAdminRole,
    canCommit,
    assertCanCommit,
    assertConcertmaster,
    normalizeSnapshot,
    buildVersionMap,
    filterVisibleVersions,
    sameVersion,
    pickMergedVersion,
    normalizeResolutions,
  },
};
