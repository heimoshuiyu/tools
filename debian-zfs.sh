codename=$(lsb_release -cs);echo "deb http://deb.debian.org/debian $codename-backports main contrib non-free"|sudo tee -a /etc/apt/sources.list && sudo apt update
sudo apt install -y linux-headers-amd64
sudo apt install -y -t stable-backports zfsutils-linux
