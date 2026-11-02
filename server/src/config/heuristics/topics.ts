// Topic library: a pool of topics, not a fixed syllabus. The topic planner
// picks a window of it based on starting rating and target, orders it by
// prerequisites, and fits it into the user's study days.
//
// `entryRating` is roughly where the topic starts to matter in contests.
// `cfTags` are real Codeforces problem tags. Some ideas (prefix sums, arrays)
// have no dedicated tag, so their tags are approximations and
// `fallbackTags` widen the search when needed.

export type PhaseNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const PHASE_NAMES: Record<PhaseNumber, string> = {
  1: 'Foundation',
  2: 'Core problem-solving',
  3: 'Intermediate algorithms',
  4: 'Advanced core topics',
  5: 'Target-level preparation',
  6: 'Benchmark and contest preparation',
};

export interface Subtopic {
  name: string;
  objective: string;
}

export interface TopicDefinition {
  id: string;
  name: string;
  phase: PhaseNumber;
  entryRating: number;
  prerequisites: string[];
  cfTags: string[];
  fallbackTags: string[];
  /** One study day per subtopic when time allows. */
  subtopics: Subtopic[];
  concept: string;
  whyItMatters: string;
}

export const TOPICS: readonly TopicDefinition[] = [
  // ---------- Phase 1: Foundation ----------
  {
    id: 'fundamentals',
    name: 'Programming fundamentals',
    phase: 1,
    entryRating: 0,
    prerequisites: [],
    cfTags: ['implementation'],
    fallbackTags: ['math'],
    subtopics: [
      { name: 'Fast input/output and reading test cases', objective: 'Read t test cases correctly and print answers in the required format.' },
      { name: 'Conditionals and loops', objective: 'Translate a statement into if/else and loops without off-by-one errors.' },
      { name: 'Integer types and overflow', objective: 'Know when values exceed 32-bit and use 64-bit integers.' },
      { name: 'Functions and clean structure', objective: 'Split a solution into small functions you can test separately.' },
    ],
    concept:
      'Competitive programming solutions read input, compute, and print output within strict limits. Most early wrong answers come from input handling, overflow and off-by-one errors, not from the idea. A solid template and careful reading of constraints remove a whole class of mistakes.',
    whyItMatters: 'Every later topic assumes you can implement an idea quickly and correctly.',
  },
  {
    id: 'implementation',
    name: 'Implementation and simulation',
    phase: 1,
    entryRating: 200,
    prerequisites: ['fundamentals'],
    cfTags: ['implementation'],
    fallbackTags: ['brute force'],
    subtopics: [
      { name: 'Direct simulation', objective: 'Simulate the process exactly as described and check it against the samples.' },
      { name: 'Case analysis', objective: 'List all cases the statement allows before coding.' },
      { name: 'Grids and coordinates', objective: 'Move around a grid safely with bounds checks and direction arrays.' },
      { name: 'Careful edge cases', objective: 'Test n = 1, all-equal inputs and maximum values before submitting.' },
    ],
    concept:
      'Implementation problems have no hidden trick: the challenge is turning a precise description into correct code. Plan the steps, choose simple data representations, and test small and edge cases by hand.',
    whyItMatters: 'Div. 2/3/4 A and B problems are often pure implementation; solving them fast sets up your whole contest.',
  },
  {
    id: 'arrays-frequency',
    name: 'Arrays and frequency counting',
    phase: 1,
    entryRating: 300,
    prerequisites: ['implementation'],
    cfTags: ['implementation', 'brute force'],
    fallbackTags: ['greedy'],
    subtopics: [
      { name: 'Counting occurrences', objective: 'Use a count array or map to answer "how many times" questions in O(n).' },
      { name: 'Minimum, maximum and positions', objective: 'Track extremes and their indices in one pass.' },
      { name: 'Pairs and simple nested loops', objective: 'Recognise when O(n²) over pairs fits the limits.' },
    ],
    concept:
      'Many problems reduce to counting how often values appear or finding extremes. A frequency array (for small values) or a map (for large values) turns repeated scans into a single pass.',
    whyItMatters: 'Counting is the building block for greedy, hashing and combinatorics later.',
  },
  {
    id: 'strings-basics',
    name: 'String processing',
    phase: 1,
    entryRating: 400,
    prerequisites: ['implementation'],
    cfTags: ['strings'],
    fallbackTags: ['implementation'],
    subtopics: [
      { name: 'Character manipulation', objective: 'Convert, compare and count characters with ASCII arithmetic.' },
      { name: 'Palindromes and reversals', objective: 'Check symmetric properties with two indices.' },
      { name: 'Substrings and patterns', objective: 'Scan substrings efficiently and avoid accidental O(n²) copies.' },
    ],
    concept:
      'Strings are arrays of characters. Most beginner string problems need counting letters, comparing positions symmetrically, or scanning windows, while avoiding expensive copies inside loops.',
    whyItMatters: 'String tasks appear in nearly every Div. 3/4 round.',
  },
  {
    id: 'sorting',
    name: 'Sorting',
    phase: 1,
    entryRating: 500,
    prerequisites: ['arrays-frequency'],
    cfTags: ['sortings'],
    fallbackTags: ['greedy'],
    subtopics: [
      { name: 'Sorting to reveal structure', objective: 'Sort first and see which observations become easy.' },
      { name: 'Custom comparators and pairs', objective: 'Sort records by several keys correctly.' },
      { name: 'Sorting with original indices', objective: 'Keep original positions when the answer refers to them.' },
    ],
    concept:
      'Sorting costs O(n log n) and often turns a hard question into a scan: neighbours become comparable, duplicates become adjacent, and the smallest or largest choices are at the ends.',
    whyItMatters: 'Sorting is the first step of most greedy and two-pointer solutions.',
  },
  {
    id: 'basic-math',
    name: 'Basic mathematics',
    phase: 1,
    entryRating: 500,
    prerequisites: ['fundamentals'],
    cfTags: ['math'],
    fallbackTags: ['implementation'],
    subtopics: [
      { name: 'Parity and divisibility', objective: 'Use even/odd and remainder arguments to rule out cases.' },
      { name: 'Formulas instead of loops', objective: 'Replace a simulation with a closed-form count.' },
      { name: 'Ceil, floor and rounding', objective: 'Compute ceil(a / b) with integers and avoid floating-point errors.' },
    ],
    concept:
      'Many easy problems hide a short formula. Parity, divisibility and simple algebra can replace a slow simulation with an O(1) answer.',
    whyItMatters: 'Math observations are the most common trick in A/B problems.',
  },
  {
    id: 'stl-basics',
    name: 'Core data structures (STL)',
    phase: 1,
    entryRating: 600,
    prerequisites: ['sorting'],
    cfTags: ['data structures', 'sortings'],
    fallbackTags: ['implementation'],
    subtopics: [
      { name: 'Vectors, pairs and sort', objective: 'Use dynamic arrays and pairs fluently.' },
      { name: 'Maps and sets for lookups', objective: 'Answer membership and count queries in O(log n).' },
      { name: 'Stacks and queues', objective: 'Recognise last-in-first-out and first-in-first-out processes.' },
    ],
    concept:
      'Standard containers give you ready-made, tested data structures. Picking the right one (set for uniqueness, map for counts, stack for nesting) often is the solution.',
    whyItMatters: 'Fluency with containers saves time in every contest.',
  },

  // ---------- Phase 2: Core problem-solving ----------
  {
    id: 'brute-force',
    name: 'Brute force and complete search',
    phase: 2,
    entryRating: 700,
    prerequisites: ['implementation'],
    cfTags: ['brute force'],
    fallbackTags: ['implementation'],
    subtopics: [
      { name: 'Estimating complexity from constraints', objective: 'Use n to decide whether O(n²), O(n log n) or O(n) is needed.' },
      { name: 'Trying all candidates', objective: 'Enumerate all answers when the search space is small.' },
      { name: 'Reducing the search space', objective: 'Find a bound that makes complete search fast enough.' },
    ],
    concept:
      'Before looking for a clever idea, check whether trying everything fits in the time limit. About 10⁸ simple operations per second is a useful rule of thumb. Brute force also produces correct answers to test faster solutions against.',
    whyItMatters: 'Reading constraints is how you choose an approach in every problem.',
  },
  {
    id: 'greedy',
    name: 'Greedy algorithms',
    phase: 2,
    entryRating: 800,
    prerequisites: ['sorting'],
    cfTags: ['greedy'],
    fallbackTags: ['sortings', 'constructive algorithms'],
    subtopics: [
      { name: 'Locally optimal choices', objective: 'Make the best choice at each step and argue why it is safe.' },
      { name: 'Exchange arguments', objective: 'Prove a greedy order by swapping two adjacent choices.' },
      { name: 'Greedy after sorting', objective: 'Combine sorting with a single greedy pass.' },
      { name: 'Spotting where greedy fails', objective: 'Find counterexamples to tempting but wrong greedy rules.' },
    ],
    concept:
      'A greedy algorithm builds the answer by repeatedly taking the choice that looks best now. It is correct only when you can argue that some optimal answer agrees with that choice, usually via an exchange argument. Test small cases to catch wrong greedy rules.',
    whyItMatters: 'Greedy is the most frequent tag on Codeforces from 800 to 1600.',
  },
  {
    id: 'prefix-sums',
    name: 'Prefix sums and difference arrays',
    phase: 2,
    entryRating: 900,
    prerequisites: ['arrays-frequency'],
    cfTags: ['implementation', 'data structures', 'brute force'],
    fallbackTags: ['math'],
    subtopics: [
      { name: 'Range sum queries', objective: 'Answer sum(l..r) in O(1) after O(n) preprocessing.' },
      { name: 'Difference arrays for range updates', objective: 'Apply many range additions in O(n + q).' },
      { name: 'Prefix counts and 2D prefix sums', objective: 'Count elements with a property in any range or rectangle.' },
    ],
    concept:
      'A prefix sum array stores p[i] = a[1] + … + a[i], so any range sum is p[r] − p[l−1]. The reverse trick, a difference array, applies range updates in O(1) each. Codeforces has no dedicated tag for this, so these problems come from related tags.',
    whyItMatters: 'Prefix sums turn many O(n²) ideas into O(n).',
  },
  {
    id: 'two-pointers',
    name: 'Two pointers and sliding window',
    phase: 2,
    entryRating: 1000,
    prerequisites: ['sorting'],
    cfTags: ['two pointers'],
    fallbackTags: ['binary search', 'sortings'],
    subtopics: [
      { name: 'Pairs in a sorted array', objective: 'Move two indices towards each other to find pairs.' },
      { name: 'Sliding window', objective: 'Maintain a window satisfying a condition while both ends only move forward.' },
      { name: 'Counting subarrays', objective: 'Count all good subarrays in O(n) with a window.' },
    ],
    concept:
      'When a condition is monotonic (growing the window only makes it "worse"), two indices that only move forward visit every candidate in O(n) total instead of O(n²).',
    whyItMatters: 'A standard way to remove a nested loop at the 1000–1500 level.',
  },
  {
    id: 'number-theory-basics',
    name: 'Number theory basics',
    phase: 2,
    entryRating: 1000,
    prerequisites: ['basic-math'],
    cfTags: ['number theory'],
    fallbackTags: ['math'],
    subtopics: [
      { name: 'GCD and LCM', objective: 'Use the Euclidean algorithm and its properties.' },
      { name: 'Divisors and primality', objective: 'Enumerate divisors and test primes in O(√n).' },
      { name: 'Modular arithmetic', objective: 'Add and multiply under a modulus without overflow.' },
    ],
    concept:
      'Number theory problems use divisibility structure: GCD, prime factors and remainders. Enumerating divisors up to √n and reasoning about remainders solve most problems at this level.',
    whyItMatters: 'Math and number theory together appear in a large share of Div. 2 problems.',
  },
  {
    id: 'binary-search-basics',
    name: 'Binary search fundamentals',
    phase: 2,
    entryRating: 1000,
    prerequisites: ['sorting'],
    cfTags: ['binary search'],
    fallbackTags: ['sortings', 'two pointers'],
    subtopics: [
      { name: 'Searching in a sorted array', objective: 'Implement lower/upper bound without infinite loops.' },
      { name: 'Counting with bounds', objective: 'Count elements in a value range with two searches.' },
      { name: 'Monotonic predicates', objective: 'Recognise a yes/no condition that switches once.' },
    ],
    concept:
      'Binary search finds the boundary of a monotonic yes/no condition in O(log n) steps. Get the invariant right: decide what lo and hi mean and keep that meaning on every iteration.',
    whyItMatters: 'Binary search underlies "binary search on the answer", one of the most reused ideas.',
  },

  // ---------- Phase 3: Intermediate algorithms ----------
  {
    id: 'maps-sets',
    name: 'Maps, sets and ordered structures',
    phase: 3,
    entryRating: 1100,
    prerequisites: ['stl-basics'],
    cfTags: ['data structures'],
    fallbackTags: ['sortings', 'greedy'],
    subtopics: [
      { name: 'Ordered sets for nearest values', objective: 'Find the next larger or smaller element dynamically.' },
      { name: 'Multisets and priority queues', objective: 'Always access the current minimum or maximum quickly.' },
    ],
    concept:
      'Balanced-tree containers keep elements sorted under insertions and deletions, so "closest value" and "current best" queries take O(log n). Priority queues give the best element fastest when you only need one end.',
    whyItMatters: 'They implement many greedy solutions efficiently.',
  },
  {
    id: 'recursion',
    name: 'Recursion and backtracking',
    phase: 3,
    entryRating: 1100,
    prerequisites: ['brute-force'],
    cfTags: ['brute force', 'dfs and similar'],
    fallbackTags: ['implementation'],
    subtopics: [
      { name: 'Recursive thinking', objective: 'Define a problem in terms of smaller copies of itself.' },
      { name: 'Generating subsets and permutations', objective: 'Enumerate all configurations with backtracking.' },
    ],
    concept:
      'Recursion solves a problem by reducing it to smaller instances with a clear base case. Backtracking explores choices one at a time and undoes them, which is the basis for complete search and, later, dynamic programming.',
    whyItMatters: 'Recursive thinking is required for DP, DFS and divide and conquer.',
  },
  {
    id: 'binary-search-answer',
    name: 'Binary search on the answer',
    phase: 3,
    entryRating: 1200,
    prerequisites: ['binary-search-basics'],
    cfTags: ['binary search'],
    fallbackTags: ['greedy'],
    subtopics: [
      { name: 'Turning optimisation into a yes/no check', objective: 'Ask "can the answer be at least x?" and check it greedily.' },
      { name: 'Writing the check function', objective: 'Implement an O(n) feasibility check.' },
      { name: 'Real-valued and large ranges', objective: 'Search over 10¹⁸ or real numbers safely.' },
    ],
    concept:
      'If "answer ≥ x is achievable" is monotonic in x, binary search on x and only solve the easier decision problem. The check is often a simple greedy pass.',
    whyItMatters: 'Very common at 1200–1800 and easy to miss without practice.',
  },
  {
    id: 'bit-manipulation',
    name: 'Bit manipulation',
    phase: 3,
    entryRating: 1200,
    prerequisites: ['basic-math'],
    cfTags: ['bitmasks'],
    fallbackTags: ['math', 'constructive algorithms'],
    subtopics: [
      { name: 'Binary representation and bitwise operators', objective: 'Use AND, OR, XOR and shifts confidently.' },
      { name: 'XOR properties', objective: 'Use a ^ a = 0 and prefix XOR to simplify problems.' },
      { name: 'Bit-by-bit reasoning', objective: 'Solve each bit independently when operations are bitwise.' },
    ],
    concept:
      'Bitwise operations act on each bit independently, so many problems split into ≤ 30–60 independent one-bit problems. XOR in particular cancels itself, which makes prefix XOR and pairing arguments powerful.',
    whyItMatters: 'Bit problems are frequent in Div. 2 B–D.',
  },
  {
    id: 'constructive',
    name: 'Constructive algorithms',
    phase: 3,
    entryRating: 1200,
    prerequisites: ['greedy'],
    cfTags: ['constructive algorithms'],
    fallbackTags: ['greedy', 'math'],
    subtopics: [
      { name: 'Building from small cases', objective: 'Solve n = 1..5 by hand and generalise the pattern.' },
      { name: 'Impossibility conditions', objective: 'Find a necessary condition and show it is also sufficient.' },
      { name: 'Invariants', objective: 'Identify what an operation never changes.' },
    ],
    concept:
      'Constructive problems ask you to build any valid answer (or say none exists). Work small cases by hand, look for a simple pattern, and find the invariant that decides when an answer is impossible.',
    whyItMatters: 'Constructive problems are a hallmark of Codeforces rounds at every level.',
  },
  {
    id: 'dp-basics',
    name: 'Dynamic programming basics',
    phase: 3,
    entryRating: 1300,
    prerequisites: ['recursion'],
    cfTags: ['dp'],
    fallbackTags: ['greedy', 'brute force'],
    subtopics: [
      { name: 'States and transitions', objective: 'Define dp[i] precisely and write its recurrence.' },
      { name: 'Classic 1D DP', objective: 'Solve take/skip and ways-to-reach problems.' },
      { name: 'Knapsack-style DP', objective: 'Handle a capacity dimension in the state.' },
      { name: '2D grid and sequence DP', objective: 'Build tables over two indices (e.g. LCS-like).' },
    ],
    concept:
      'Dynamic programming stores answers to subproblems so each is solved once. The work is choosing a state that captures everything the future needs, then writing transitions and base cases.',
    whyItMatters: 'DP is the second most common tag and dominates harder problems.',
  },
  {
    id: 'graph-fundamentals',
    name: 'Graph fundamentals',
    phase: 3,
    entryRating: 1300,
    prerequisites: ['stl-basics', 'recursion'],
    cfTags: ['graphs', 'dfs and similar'],
    fallbackTags: ['trees'],
    subtopics: [
      { name: 'Representing graphs', objective: 'Build adjacency lists from edge input.' },
      { name: 'Connectivity and components', objective: 'Count components with a traversal.' },
      { name: 'Modelling problems as graphs', objective: 'Spot hidden graphs in grid and relation problems.' },
    ],
    concept:
      'A graph is a set of vertices connected by edges. Many problems about relations, grids or states are graph problems in disguise; the first step is to define the vertices and edges.',
    whyItMatters: 'Graphs open up a large set of problems from 1300 upwards.',
  },

  // ---------- Phase 4: Advanced core topics ----------
  {
    id: 'bfs-dfs',
    name: 'BFS and DFS',
    phase: 4,
    entryRating: 1400,
    prerequisites: ['graph-fundamentals'],
    cfTags: ['dfs and similar', 'graphs'],
    fallbackTags: ['shortest paths', 'trees'],
    subtopics: [
      { name: 'BFS for shortest paths in unweighted graphs', objective: 'Compute distances layer by layer.' },
      { name: 'DFS order, cycles and bipartiteness', objective: 'Detect cycles and 2-colour a graph.' },
      { name: 'Multi-source and grid BFS', objective: 'Start BFS from many sources at once.' },
      { name: 'Topological order', objective: 'Order a DAG and detect when no order exists.' },
    ],
    concept:
      'BFS explores by distance and gives shortest paths when all edges cost the same. DFS explores deeply and reveals structure such as cycles, components and DAG order.',
    whyItMatters: 'Traversals are the base of nearly every graph and tree technique.',
  },
  {
    id: 'trees',
    name: 'Trees',
    phase: 4,
    entryRating: 1500,
    prerequisites: ['bfs-dfs'],
    cfTags: ['trees'],
    fallbackTags: ['dfs and similar', 'dp'],
    subtopics: [
      { name: 'Rooting a tree and subtree sizes', objective: 'Compute parent, depth and subtree size with one DFS.' },
      { name: 'Diameter and distances', objective: 'Find the diameter with two traversals.' },
      { name: 'DP on trees', objective: 'Combine children results at each vertex.' },
      { name: 'Rerooting', objective: 'Compute an answer for every root in O(n).' },
    ],
    concept:
      'A tree is a connected graph without cycles, so every pair of vertices has exactly one path. Rooting the tree turns most problems into combining results from subtrees.',
    whyItMatters: 'Tree problems are frequent from 1500 and grow in difficulty quickly.',
  },
  {
    id: 'dsu',
    name: 'Disjoint set union (DSU)',
    phase: 4,
    entryRating: 1600,
    prerequisites: ['graph-fundamentals'],
    cfTags: ['dsu'],
    fallbackTags: ['graphs', 'data structures'],
    subtopics: [
      { name: 'Union-find with path compression', objective: 'Implement DSU with near-constant operations.' },
      { name: 'Offline connectivity and Kruskal', objective: 'Process edges in sorted order to build an MST.' },
      { name: 'Storing data in components', objective: 'Maintain sizes or extra values per set.' },
    ],
    concept:
      'DSU maintains a partition of elements into groups with fast "merge" and "same group?" operations. Combined with sorting it builds minimum spanning trees and answers connectivity offline.',
    whyItMatters: 'A compact tool that solves many 1600–2000 graph problems.',
  },
  {
    id: 'dp-intermediate',
    name: 'Intermediate dynamic programming',
    phase: 4,
    entryRating: 1600,
    prerequisites: ['dp-basics'],
    cfTags: ['dp'],
    fallbackTags: ['greedy', 'combinatorics'],
    subtopics: [
      { name: 'Choosing better states', objective: 'Reduce state size by finding what really matters.' },
      { name: 'DP with prefix-sum optimisation', objective: 'Speed up transitions that sum over ranges.' },
      { name: 'Interval DP', objective: 'Solve problems over segments [l, r].' },
      { name: 'Counting DP modulo a prime', objective: 'Count configurations without overflow.' },
    ],
    concept:
      'Intermediate DP is mostly about finding the right state and making transitions fast. Common speed-ups are prefix sums over previous states and reordering loops.',
    whyItMatters: 'Expert-level problems often need a non-obvious DP state.',
  },
  {
    id: 'number-theory-intermediate',
    name: 'Intermediate number theory',
    phase: 4,
    entryRating: 1600,
    prerequisites: ['number-theory-basics'],
    cfTags: ['number theory'],
    fallbackTags: ['math', 'combinatorics'],
    subtopics: [
      { name: 'Sieve and prime factorisation', objective: 'Factorise many numbers quickly with a sieve.' },
      { name: 'Modular inverse and fast exponentiation', objective: 'Divide under a prime modulus.' },
      { name: 'Divisor-sum and GCD tricks', objective: 'Iterate over multiples instead of pairs.' },
    ],
    concept:
      'With a sieve you can factorise every number up to 10⁶–10⁷. Fast exponentiation and Fermat inverses make division under a prime modulus possible, which counting problems rely on.',
    whyItMatters: 'Needed for most counting and divisibility problems above 1600.',
  },
  {
    id: 'shortest-paths',
    name: 'Shortest paths',
    phase: 4,
    entryRating: 1700,
    prerequisites: ['bfs-dfs'],
    cfTags: ['shortest paths'],
    fallbackTags: ['graphs'],
    subtopics: [
      { name: "Dijkstra's algorithm", objective: 'Find shortest paths with non-negative weights.' },
      { name: '0-1 BFS and state graphs', objective: 'Add extra state to vertices when needed.' },
      { name: 'Floyd–Warshall and Bellman–Ford', objective: 'Know when the slower algorithms are required.' },
    ],
    concept:
      'Dijkstra extends BFS to weighted graphs with a priority queue. Many harder problems become shortest-path problems once you add the right extra information to each vertex.',
    whyItMatters: 'A staple of graph problems from 1700.',
  },
  {
    id: 'combinatorics',
    name: 'Combinatorics',
    phase: 4,
    entryRating: 1700,
    prerequisites: ['number-theory-intermediate'],
    cfTags: ['combinatorics'],
    fallbackTags: ['math', 'dp'],
    subtopics: [
      { name: 'Binomial coefficients modulo p', objective: 'Precompute factorials and inverse factorials.' },
      { name: 'Counting by contribution', objective: 'Count how many times each element contributes.' },
      { name: 'Inclusion–exclusion', objective: 'Correct over-counting systematically.' },
    ],
    concept:
      'Combinatorics counts arrangements without listing them. Contribution technique (sum over elements of how often each counts) and binomial coefficients cover most problems.',
    whyItMatters: 'Counting problems become common from 1700 upwards.',
  },
  {
    id: 'data-structures',
    name: 'Range query data structures',
    phase: 4,
    entryRating: 1700,
    prerequisites: ['maps-sets', 'prefix-sums'],
    cfTags: ['data structures'],
    fallbackTags: ['binary search', 'sortings'],
    subtopics: [
      { name: 'Fenwick tree (BIT)', objective: 'Support point updates and prefix queries in O(log n).' },
      { name: 'Sparse table', objective: 'Answer static range min/max in O(1).' },
      { name: 'Offline processing with sorting', objective: 'Reorder queries to make them easier.' },
      { name: 'Monotonic stack and deque', objective: 'Find nearest greater elements in O(n).' },
    ],
    concept:
      'When prefix sums are not enough because values change, structures like the Fenwick tree support updates and range queries in O(log n). Monotonic stacks answer "nearest larger" questions in linear time.',
    whyItMatters: 'Needed for many problems that combine queries with updates.',
  },

  // ---------- Phase 5: Target-level topics ----------
  {
    id: 'advanced-greedy',
    name: 'Advanced greedy and observations',
    phase: 5,
    entryRating: 1700,
    prerequisites: ['greedy', 'constructive'],
    cfTags: ['greedy'],
    fallbackTags: ['constructive algorithms', 'sortings'],
    subtopics: [
      { name: 'Greedy with priority queues', objective: 'Make the best choice with a changing candidate set.' },
      { name: 'Proving greedy under pressure', objective: 'Find a quick convincing argument in contest time.' },
      { name: 'Reformulating the problem', objective: 'Restate the problem until the greedy choice is clear.' },
    ],
    concept:
      'Harder greedy problems hide the right order or the right quantity to optimise. Restating the problem and checking small cases with brute force reveal it.',
    whyItMatters: 'Harder Div. 2 C/D problems are often "just" a greedy observation.',
  },
  {
    id: 'advanced-constructive',
    name: 'Advanced constructive problems',
    phase: 5,
    entryRating: 1800,
    prerequisites: ['constructive'],
    cfTags: ['constructive algorithms'],
    fallbackTags: ['greedy', 'math'],
    subtopics: [
      { name: 'Constructions with parity and invariants', objective: 'Use invariants to rule out cases quickly.' },
      { name: 'Recursive and incremental constructions', objective: 'Build an answer for n from one for n − 2.' },
    ],
    concept:
      'At this level constructions need an argument for impossibility and a systematic way to build the answer, often by induction from smaller cases.',
    whyItMatters: 'Frequent in Div. 1/2 rounds at 1800–2100.',
  },
  {
    id: 'games',
    name: 'Game theory',
    phase: 5,
    entryRating: 1800,
    prerequisites: ['dp-basics'],
    cfTags: ['games'],
    fallbackTags: ['math', 'constructive algorithms'],
    subtopics: [
      { name: 'Winning and losing positions', objective: 'Classify small positions and find the pattern.' },
      { name: 'Symmetry and mirroring strategies', objective: 'Copy the opponent to keep an invariant.' },
    ],
    concept:
      'In two-player games with perfect information, each position is winning or losing. Compute small cases by DP, then look for a pattern or an invariant strategy.',
    whyItMatters: 'Game problems appear regularly and reward pattern spotting.',
  },
  {
    id: 'dp-advanced',
    name: 'Advanced dynamic programming',
    phase: 5,
    entryRating: 1900,
    prerequisites: ['dp-intermediate', 'bit-manipulation'],
    cfTags: ['dp'],
    fallbackTags: ['bitmasks', 'trees'],
    subtopics: [
      { name: 'Bitmask DP', objective: 'Use subsets as states for n ≤ 20.' },
      { name: 'DP on trees with merging', objective: 'Merge child tables efficiently.' },
      { name: 'Digit DP', objective: 'Count numbers up to N with a property.' },
      { name: 'DP optimisation ideas', objective: 'Recognise monotone transitions that allow speed-ups.' },
    ],
    concept:
      'Advanced DP combines unusual state spaces (subsets, digits, tree merges) with optimisations that keep transitions fast.',
    whyItMatters: 'DP is central to Candidate Master level problems.',
  },
  {
    id: 'strings-advanced',
    name: 'String algorithms',
    phase: 5,
    entryRating: 1900,
    prerequisites: ['strings-basics'],
    cfTags: ['strings', 'hashing'],
    fallbackTags: ['string suffix structures'],
    subtopics: [
      { name: 'Polynomial hashing', objective: 'Compare substrings in O(1) with low collision risk.' },
      { name: 'Prefix function and Z-function', objective: 'Find pattern occurrences in linear time.' },
      { name: 'Palindromes and borders', objective: 'Use border structure to count patterns.' },
    ],
    concept:
      'Linear-time string algorithms (prefix function, Z-function) and hashing compare substrings quickly, turning quadratic matching into linear or n log n work.',
    whyItMatters: 'Needed for string problems above 1900.',
  },
  {
    id: 'segment-trees',
    name: 'Segment trees',
    phase: 5,
    entryRating: 1900,
    prerequisites: ['data-structures'],
    cfTags: ['data structures'],
    fallbackTags: ['binary search', 'divide and conquer'],
    subtopics: [
      { name: 'Point update, range query', objective: 'Implement a reusable segment tree.' },
      { name: 'Lazy propagation', objective: 'Apply range updates in O(log n).' },
      { name: 'Custom merge functions', objective: 'Store combined information like max-subarray in nodes.' },
      { name: 'Descending the tree', objective: 'Find the first position satisfying a condition in O(log n).' },
    ],
    concept:
      'A segment tree stores information about ranges in a binary tree so updates and queries over any range take O(log n). Defining what each node stores and how two nodes merge is the core skill.',
    whyItMatters: 'The most versatile data structure in competitive programming.',
  },
  {
    id: 'graphs-advanced',
    name: 'Advanced graph algorithms',
    phase: 5,
    entryRating: 2000,
    prerequisites: ['trees', 'shortest-paths', 'dsu'],
    cfTags: ['graphs', 'trees'],
    fallbackTags: ['dfs and similar', 'shortest paths'],
    subtopics: [
      { name: 'Lowest common ancestor and binary lifting', objective: 'Answer path queries on trees in O(log n).' },
      { name: 'Bridges, articulation points and SCCs', objective: 'Decompose graphs by connectivity.' },
      { name: 'Euler tour techniques', objective: 'Flatten a tree to answer subtree queries with arrays.' },
    ],
    concept:
      'Binary lifting, Euler tours and connectivity decompositions turn complex tree and graph questions into array and range problems.',
    whyItMatters: 'Common in Div. 1 and harder Div. 2 rounds.',
  },
  {
    id: 'divide-conquer',
    name: 'Divide and conquer',
    phase: 5,
    entryRating: 2100,
    prerequisites: ['recursion', 'data-structures'],
    cfTags: ['divide and conquer'],
    fallbackTags: ['data structures', 'binary search'],
    subtopics: [
      { name: 'Splitting and combining', objective: 'Count cross pairs while merging halves.' },
      { name: 'Divide and conquer over queries', objective: 'Process queries offline by halves.' },
    ],
    concept:
      'Split the input in halves, solve each recursively and count the interactions across the split. Total work is often O(n log n).',
    whyItMatters: 'A key idea for Master-level problems.',
  },
  {
    id: 'probabilities',
    name: 'Probability and expected value',
    phase: 5,
    entryRating: 2100,
    prerequisites: ['combinatorics'],
    cfTags: ['probabilities'],
    fallbackTags: ['math', 'dp'],
    subtopics: [
      { name: 'Linearity of expectation', objective: 'Sum expectations of indicator variables.' },
      { name: 'Expected value DP modulo p', objective: 'Compute expectations as modular fractions.' },
    ],
    concept:
      'Linearity of expectation lets you add expected values of simple indicators even when events are dependent. With modular inverses, answers are printed as fractions modulo a prime.',
    whyItMatters: 'Appears regularly in harder rounds.',
  },
  {
    id: 'flows-matchings',
    name: 'Flows and matchings',
    phase: 5,
    entryRating: 2300,
    prerequisites: ['graphs-advanced'],
    cfTags: ['flows', 'graph matchings'],
    fallbackTags: ['graphs'],
    subtopics: [
      { name: 'Maximum flow and minimum cut', objective: 'Model capacities and compute max flow.' },
      { name: 'Bipartite matching', objective: 'Model assignment problems as matchings.' },
    ],
    concept:
      'Flow networks model how much can move from a source to a sink under capacities. Max-flow/min-cut duality and bipartite matching solve many assignment problems.',
    whyItMatters: 'Needed for some 2300+ problems.',
  },
];

export function topicById(id: string): TopicDefinition | undefined {
  return TOPICS.find((t) => t.id === id);
}
