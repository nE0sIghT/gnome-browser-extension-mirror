ARG PYTHON_VERSION

FROM docker.io/python:$PYTHON_VERSION
SHELL ["/bin/bash", "-exo", "pipefail", "-c"]

COPY requirements.txt /tmp/pip-tmp/

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
        xauth \
    ;\
    pip --disable-pip-version-check --no-cache-dir \
        install \
        -r /tmp/pip-tmp/requirements.txt \
    ;\
    rm -rf /tmp/pip-tmp ;\
    adduser --disabled-password --gecos '' vscode ;\
    echo "vscode ALL=(root) NOPASSWD: ALL" > /etc/sudoers.d/vscode

ENTRYPOINT [ "/bin/sh" ]
CMD [ "-c", "sleep infinity" ]
