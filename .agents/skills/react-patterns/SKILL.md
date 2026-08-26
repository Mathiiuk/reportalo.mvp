---
name: react-patterns
description: React 18 patterns including hooks discipline, server/client component boundaries, Suspense + error boundaries, form handling, data fetching, state management decision trees, and accessibility-first composition. Use when writing or reviewing React components.
metadata:
  origin: ECC
---

# React Patterns (React 18 Focus)

Idiomatic React 18 patterns for building robust, accessible, performant component trees.

## When to Activate

- Writing or modifying React function components, custom hooks, or component trees
- Reviewing JSX/TSX files
- Designing state shape or component composition
- Migrating class components or older `forwardRef`/`useEffect`-heavy code
- Choosing between local state, lifted state, context, and external stores
- Working with Server Components / Client Components (Next.js App Router, RSC)
- Implementing forms (controlled or with libraries)
- Wiring data fetching with TanStack Query / SWR / RSC

## Core Principles

### 1. Render is a Pure Function of Props and State

```tsx
// Good: derive during render
function Cart({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return <span>{formatMoney(total)}</span>;
}

// Bad: derived state stored separately
function Cart({ items }: { items: CartItem[] }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  }, [items]);
  return <span>{formatMoney(total)}</span>;
}
Derived state in useEffect adds a render cycle, can desync, and obscures the data flow.

2. Side Effects Outside Render
Effects, mutations, network calls, and subscriptions live in event handlers or useEffect — never in the render body.

3. Composition Over Inheritance
React has no inheritance model for components. Compose with children, render props, or component props.

Hooks Discipline
See rules/react/hooks.md for the full ruleset. Highlights:

Top-level only, never conditional

Cleanup every subscription, interval, listener

Functional updater (setX(prev => prev + 1)) when new state depends on old

Default position: do not memoize — add useMemo/useCallback only when a profiler or a dependency chain proves it matters

Extract a custom hook only when the same hook sequence appears in 2+ components

State Location Decision Tree
text
Used by one component?
  -> useState inside it

Used by parent + a few descendants?
  -> lift to nearest common ancestor

Used across distant branches AND low-frequency reads (theme, auth, locale)?
  -> React Context

High-frequency updates shared across the tree?
  -> external store (Zustand, Jotai, Redux Toolkit)

Derived from a server?
  -> server-state library (TanStack Query, SWR, RSC fetch)
Most pages do not need context or a global store. Resist abstraction until duplicated lifting becomes painful.

Server / Client Components (RSC)
React 18 supports Server Components, but they are experimental without a framework. In practice, use them with Next.js App Router or similar.

tsx
// Server Component - default, async, never ships JS for itself (in Next.js)
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();
  return <ProductView product={product} />;
}

// Client Component - opt in with "use client" (Next.js)
"use client";
export function AddToCartButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const addToCart = async () => {
    startTransition(async () => {
      await fetch('/api/cart', { method: 'POST', body: JSON.stringify({ productId }) });
    });
  };
  return (
    <button disabled={pending} onClick={addToCart}>
      {pending ? "Adding..." : "Add to cart"}
    </button>
  );
}
Boundaries:

Server -> Client: pass serializable props or children

Client -> Server: use API routes or Server Actions (if framework supports)

Never import a Server Component from a Client Component file — compose them via children instead

Suspense + Error Boundaries
tsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<UserSkeleton />}>
    <UserDetail id={id} />
  </Suspense>
</ErrorBoundary>
Place Suspense boundaries close to the data, not at the route root — progressively reveal content

Error Boundary remains a class API; use react-error-boundary for a hook-friendly wrapper

A boundary catches errors thrown during render, lifecycle, and constructors of its children — NOT in event handlers or async code

Forms
Controlled inputs (React 18 standard)
Use controlled when the value drives other UI, formats on every keystroke, or implements real-time validation.

tsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await login({ email, password });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button type="submit" disabled={pending}>Log in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
Complex forms
For multi-step forms, dynamic field arrays, or cross-field validation: use a library (React Hook Form, TanStack Form). Roll-your-own state management for forms past trivial complexity is a maintenance trap.

Data Fetching Decision Matrix
Need  Tool
Per-request data in Next.js App Router  RSC await fetch()
Client-side cache + mutations + invalidation  TanStack Query
Lightweight client cache + revalidation SWR
Real-time subscriptions Server-Sent Events, WebSockets, or the lib's subscription API
One-off fire-and-forget fetch() in an event handler
Avoid useEffect + fetch for application data — race conditions, no cache, no retry, no Suspense integration.

Composition Recipes
Slot via children
tsx
<Layout>
  <Header />
  <Main>{content}</Main>
</Layout>
Named slots
tsx
<Page header={<Nav />} sidebar={<Filters />}>
  <Results />
</Page>
Compound components (shared state via Context)
tsx
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="profile"><Profile /></Tabs.Panel>
  <Tabs.Panel value="settings"><Settings /></Tabs.Panel>
</Tabs>
Render prop / function-as-child
Useful when the parent needs to pass parameters to the rendered output:

tsx
<DataLoader id={id}>
  {({ data, isLoading }) => isLoading ? <Spinner /> : <UserCard user={data} />}
</DataLoader>
Modern alternative: a hook (useData(id)) returning the same shape — usually cleaner.

Performance
When React.memo Actually Helps
Wrap a component in React.memo only when:

It re-renders frequently

Its props are usually the same between renders

Its render is measurably expensive

React.memo adds an equality check on every render. If props differ on most renders, the check is pure overhead.

Avoiding Render Cascades
Lift state down rather than up where possible

Split context: one context per concern, so a change to themeContext does not re-render auth consumers

Use useSyncExternalStore for external state libraries — required for safe concurrent rendering

Use useTransition to mark non-urgent updates (e.g., filtering a large list) to keep UI responsive

Lists
Provide stable key props (database id, not array index)

Virtualize long lists with @tanstack/react-virtual or react-window once visible item count exceeds ~50 with non-trivial rows

Code Splitting with React.lazy
Reduce initial bundle size by lazy-loading heavy components:

tsx
const HeavyEditor = React.lazy(() => import('./HeavyEditor'));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyEditor />
    </Suspense>
  );
}
React 18 Specific Features
Automatic Batching
React 18 batches state updates even inside setTimeout, promises, and native event handlers. This reduces renders. You rarely need flushSync — use it only when you must read DOM after an update.

useTransition and useDeferredValue
Use useTransition to mark state updates as non-urgent (e.g., filtering a large list). Use useDeferredValue to defer rendering of a part of the UI while keeping the rest responsive.

tsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => search(deferredQuery), [deferredQuery]);
  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <Results list={results} style={{ opacity: query !== deferredQuery ? 0.5 : 1 }} />
    </>
  );
}
useSyncExternalStore
For external stores (like Redux, Zustand) that rely on mutable data, use useSyncExternalStore to ensure concurrent rendering safety. Libraries typically provide their own hooks; only use it when building a custom store.

Accessibility-First Composition
Always render semantic HTML (<button>, <a>, <nav>, <main>) before reaching for role attributes

Every interactive element must be reachable by keyboard

Form inputs need labels — <label htmlFor> or aria-label if visually labeled by an icon

Manage focus on route changes and modal open/close

Run axe in component tests (see skills/react-testing)

Cross-link: skills/accessibility/SKILL.md covers WCAG criteria and pattern libraries

Routing
This skill is router-agnostic. The patterns above work with React Router, TanStack Router, Next.js App Router, Remix Router. Router-specific patterns (loaders, actions, nested layouts) follow the router's documentation — those are framework concerns layered on top of React core.

Out of Scope (Pointer Sections)
Next.js specifics: App Router data loading, Route Handlers, Middleware, Parallel Routes — separate concern, use Next.js docs

React Native: Platform-specific patterns differ enough to warrant a separate react-native-patterns skill (not present yet)

Remix: Loader/action conventions overlap with RSC but follow Remix docs

Related
Rules: rules/react/ — coding-style, hooks, patterns, security, testing

Skills: react-performance for performance ruleset, frontend-patterns for cross-framework UI concerns, accessibility, angular-developer for framework comparison

Agents: react-reviewer for code review, react-build-resolver for build/bundler errors

Commands: /react-review, /react-build, /react-test

Examples
Custom hook for debounced search
tsx
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchApi(debounced),
    enabled: debounced.length > 0,
  });
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Results items={data ?? []} />
    </>
  );
}
Optimistic UI (manual, React 18)
Since React 18 does not have useOptimistic, you can manage it with useState and useTransition:

tsx
function MessageList({ messages }: { messages: Message[] }) {
  const [optimisticMessages, setOptimisticMessages] = useState(messages);
  const [pending, startTransition] = useTransition();

  async function send(text: string) {
    const newMessage = { id: 'pending', text, sender: 'me' };
    startTransition(() => {
      setOptimisticMessages(prev => [...prev, newMessage]);
    });
    await saveMessage(text);
    // After success, replace or refetch
  }

  return (
    <>
      <ul>{optimisticMessages.map((m) => <li key={m.id}>{m.text}</li>)}</ul>
      <button onClick={() => send('hello')}>Send</button>
    </>
  );
}
Splitting context to avoid render cascades
tsx
// Two contexts: one rarely changes, one frequently
const ThemeContext = createContext<Theme>("light");
const NotificationsContext = createContext<Notification[]>([]);

// A component that only consumes ThemeContext does NOT re-render when notifications change
Testing tip for hooks and components
Use @testing-library/react and userEvent

For async behavior, use waitFor and act

Test error boundaries by throwing errors in children

Always test accessibility with axe (via jest-axe)

TypeScript best practices
Use React.FC only if you need children; otherwise prefer explicit props type

For event handlers, use React.ChangeEvent<HTMLInputElement> etc.

For custom hooks, return proper tuple or object with strict types

Avoid any; use unknown and type guards

text

Esta versión está ajustada a React 18, eliminando referencias a `useActionState`, `useOptimistic`, `useFormStatus`, `use` hook y React Compiler. Se han añadido secciones sobre características específicas de React 18 (batching, transiciones, deferred value) y se han actualizado los ejemplos de formularios a controlados. También se ha incluido una sección sobre code splitting y testing. La estructura general se mantiene, pero el contenido ahora es totalmente compatible con React 18 estable.```