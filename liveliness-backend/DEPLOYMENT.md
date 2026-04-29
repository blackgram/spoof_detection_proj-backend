# Deployment Guide (Docker + Kubernetes + SUSE)

This guide covers production-style deployment for `liveliness-backend` using:
- Docker image build and run
- Kubernetes deployment (generic + SUSE/RKE2-friendly)
- SUSE host prerequisites and DNS/network settings

## 1) Prerequisites

- Docker installed (for image build)
- Kubernetes cluster access (`kubectl` configured)
- Access Bank connectivity from runtime environment
- Silent-Face upstream code vendored:

```bash
bash scripts/vendor-silent-face.sh
```

Make sure Silent-Face model assets exist under:
- `third_party/Silent-Face-Anti-Spoofing/resources/detection_model/`
- `third_party/Silent-Face-Anti-Spoofing/resources/anti_spoof_models/`

## 2) Build Docker Image

From `liveliness-backend`:

```bash
docker build -t liveliness-backend:latest .
```

Tag and push to registry:

```bash
docker tag liveliness-backend:latest <registry>/<project>/liveliness-backend:<tag>
docker push <registry>/<project>/liveliness-backend:<tag>
```

## 3) Run with Docker (single host)

```bash
docker run --rm -p 8001:8001 \
  -e ACCESS_BANK_EFM_AUTH_TOKEN="<token>" \
  liveliness-backend:latest
```

Health check:

```bash
curl -s http://127.0.0.1:8001/health
```

If EFM DNS fails with `[Errno -2] Name or service not known`, run with explicit DNS:

```bash
docker run --rm -p 8001:8001 \
  --dns 10.1.9.11 \
  -e ACCESS_BANK_EFM_AUTH_TOKEN="<token>" \
  liveliness-backend:latest
```

## 4) Kubernetes Deployment

Create a namespace (optional):

```bash
kubectl create namespace liveliness
```

### 4.1 Secret for token

```bash
kubectl -n liveliness create secret generic liveliness-secrets \
  --from-literal=ACCESS_BANK_EFM_AUTH_TOKEN="<token>"
```

### 4.2 ConfigMap for non-secret env

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: liveliness-config
  namespace: liveliness
data:
  ACCESS_BANK_EFM_URL: "https://api.dev.accessbankplc.com/efm/v1"
```

### 4.3 Deployment + Service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: liveliness-backend
  namespace: liveliness
spec:
  replicas: 2
  selector:
    matchLabels:
      app: liveliness-backend
  template:
    metadata:
      labels:
        app: liveliness-backend
    spec:
      containers:
        - name: api
          image: <registry>/<project>/liveliness-backend:<tag>
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8001
          envFrom:
            - configMapRef:
                name: liveliness-config
          env:
            - name: ACCESS_BANK_EFM_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: liveliness-secrets
                  key: ACCESS_BANK_EFM_AUTH_TOKEN
          readinessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 20
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 30
            periodSeconds: 15
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "2"
              memory: "4Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: liveliness-backend
  namespace: liveliness
spec:
  selector:
    app: liveliness-backend
  ports:
    - name: http
      port: 80
      targetPort: 8001
  type: ClusterIP
```

Apply:

```bash
kubectl apply -f liveliness-config.yaml
kubectl apply -f liveliness-deploy.yaml
```

### 4.4 Ingress (optional)

Expose with your ingress controller (NGINX/Traefik) using `/health` as upstream health check path.

## 5) SUSE (SLES / Rancher RKE2) Notes

### 5.1 Host dependencies

- Keep system updated:

```bash
sudo zypper refresh
sudo zypper update -y
```

- Ensure time sync and DNS are correct (important for TLS + EFM endpoint resolution).

### 5.2 Firewall and networking

- If using host Docker runtime, open required ports (example):
  - `8001/tcp` for direct host access
  - `6443/tcp` Kubernetes API (cluster usage)
- In Kubernetes, prefer Service/Ingress over opening node ports directly.

### 5.3 DNS on SUSE / RKE2

If EFM host resolves only on corporate DNS:
- Configure node DNS to use corporate resolver (example `10.1.9.11`)
- For Kubernetes, ensure CoreDNS can resolve that domain (forwarders/stub domain as needed)

Example CoreDNS forward (cluster-specific, optional):

```txt
api.dev.accessbankplc.com:53 {
    forward . 10.1.9.11
}
```

### 5.4 Registry trust and mirrors (common in enterprise SUSE)

- If using private registry with custom CA:
  - install CA cert on nodes
  - configure container runtime trust
- For RKE2/containerd, configure registries in `/etc/rancher/rke2/registries.yaml` as needed.

## 6) Post-Deployment Validation

Inside cluster:

```bash
kubectl -n liveliness get pods
kubectl -n liveliness logs deploy/liveliness-backend --tail=100
kubectl -n liveliness port-forward svc/liveliness-backend 8001:80
curl -s http://127.0.0.1:8001/health
```

Functional check:
- open `/test-ui`
- run `/api/kyc/verify` with a known account
- confirm logs show successful `AccountImageCollection` call and face verification

## 7) Common Failure Modes

- `Name or service not known` on EFM call:
  - DNS path from runtime cannot resolve `api.dev.accessbankplc.com`
  - fix node/container DNS or add corporate DNS forwarders
- Build/export I/O errors:
  - low disk on Docker Desktop or host runtime
- Spoof detection startup error:
  - missing Silent-Face model files under `resources/`

