pipeline {
    agent any
    options { retry(2) }
    stages {
        stage('Installing Dependencies') {
            steps {
                nodejs(nodeJSInstallationName: '16') {
                    bat 'yarn --production=false'
                }
            }
        }
        stage('Testing') {
            steps {
                nodeTesting()
            }
        }
        stage('Build') {
            steps {
                nodejs(nodeJSInstallationName: '16') {
                    bat 'yarn build'
                }
            }
        }
    }
}
