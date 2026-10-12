from setuptools import setup, find_packages

setup(
    name="episodify-open-cut",
    version="0.1.0",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "eoc=eoc.cli:main",
            "episodify=eoc.cli:main",
        ],
    },
)
