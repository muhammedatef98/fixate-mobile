import type { CommunityComment, CommunityCommentNode } from '../services/communityService';

export type CommentSort = 'newest' | 'most_liked';

/**
 * Build a nested reply tree from a flat list of comments.
 *
 * - Top-level comments have parent_id === null.
 * - Each comment's `replies` array holds its direct children, recursively.
 * - Orphans (parent missing/deleted) are promoted to top level so nothing
 *   silently disappears.
 * - `sort` orders TOP-LEVEL comments only; replies stay chronological so a
 *   conversation reads top-to-bottom within a branch.
 */
export function buildCommentTree(
  flat: CommunityComment[],
  sort: CommentSort = 'newest'
): CommunityCommentNode[] {
  const byId = new Map<string, CommunityCommentNode>();
  for (const c of flat) {
    byId.set(c.id, { ...c, replies: [] });
  }

  const roots: CommunityCommentNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  // Replies always chronological (oldest first).
  const sortChrono = (nodes: CommunityCommentNode[]) => {
    nodes.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    for (const n of nodes) sortChrono(n.replies);
  };
  sortChrono(roots);

  // Re-order just the roots per the chosen sort.
  if (sort === 'most_liked') {
    roots.sort((a, b) => b.likes_count - a.likes_count || +new Date(b.created_at) - +new Date(a.created_at));
  } else {
    roots.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }

  return roots;
}

/** Total number of comments in a tree (including all nested replies). */
export function countComments(nodes: CommunityCommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countComments(n.replies), 0);
}
