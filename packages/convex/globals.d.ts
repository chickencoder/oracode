declare global {
  const process: {
    env: Record<string, string | undefined>;
  };
}

export {};
