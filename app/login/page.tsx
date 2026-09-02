interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const failed = params.error !== undefined;

  return (
    <div className="mx-auto mt-12 max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-stone-600">Enter the password you were given to use this prototype.</p>
      <form method="post" action="/api/login" className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block font-medium">Password</span>
          <input className="field" type="password" name="password" autoFocus autoComplete="current-password" />
        </label>
        {failed ? (
          <p role="alert" className="text-red-700">
            That password is not right. Please try again.
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary w-full">
          Continue
        </button>
      </form>
    </div>
  );
}
