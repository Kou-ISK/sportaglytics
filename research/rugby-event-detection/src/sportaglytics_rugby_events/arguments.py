from __future__ import annotations


def normalize_forwarded_args(argv: list[str]) -> list[str]:
    """Remove pnpm's literal separator when forwarded after the subcommand.

    Some pnpm versions forward ``pnpm run <script> -- --flag`` as
    ``<python> <subcommand> -- --flag``. argparse treats that standalone ``--``
    as end-of-options, so required flags after it are no longer parsed.
    """

    if len(argv) >= 2 and argv[1] == "--":
        return [argv[0], *argv[2:]]
    return argv
