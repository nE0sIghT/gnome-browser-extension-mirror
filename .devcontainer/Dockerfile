ARG PYTHON_VERSION

FROM docker.io/python:$PYTHON_VERSION
SHELL ["/bin/bash", "-exo", "pipefail", "-c"]

RUN \
    apt-get update ;\
    apt-get -y install \
        bash-completion \
        coreutils \
        cmake \
        gettext \
        git \
        git-gui \
        gitk \
        ninja-build \
        p7zip-full \
        sudo \
    ;\
    pip install \
        meson \
        polib \
        pytz \
    ;\
    adduser --disabled-password --gecos '' vscode ;\
    echo "vscode ALL=(root) NOPASSWD: ALL" > /etc/sudoers.d/vscode

ENTRYPOINT [ "/bin/sh" ]
CMD [ "-c", "sleep infinity" ]
