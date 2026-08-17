from __future__ import annotations


def normalize_forwarded_args(argv: list[str]) -> list[str]:
    """Remove pnpm's literal separator from forwarded research arguments.

    Some pnpm versions forward ``pnpm run <script> -- --flag`` as a literal
    ``--`` after the Python subcommand. Script-level defaults can appear before
    that separator, so remove the first standalone separator anywhere after the
    subcommand. These research subcommands do not use positional arguments after
    ``--``.
    """

    if len(argv) < 2:
        return argv
    try:
        separator_index = argv.index("--", 1)
    except ValueError:
        return argv
    return [*argv[:separator_index], *argv[separator_index + 1 :]]
